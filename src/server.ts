// ─── HTTP + static UI helpers ───
// send / parseRole / parseIds / readJson live here.
// ─── background index job ───

import { createServer, ServerResponse, type IncomingMessage } from "node:http";
import { exec } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { send } from "./http.ts";
import {
  getVolumeIndex,
  getVolume,
  getIssueFromVolume,
  listCachedVolumes,
  deleteVolume,
  listCachedVolumeIds,
  listCachedSummaries,
  refreshVolume,
  listCachedIssueIds,
  deleteIssueDetail,
  refreshIssueDetail,
  getCharacter,
  listCachedCharacters,
} from "./comicvine.ts";
import {
  applyBulkRead,
  applyIgnoredVol,
  applyOngoingVol,
  applyReadingVol,
  applyReadIss,
  clearBulkRead,
  clearReadIss,
  isIgnoredVol,
  isISODate,
  isOngoingVol,
  isReadingVol,
  localToday,
  progressByVolume,
  readAtOfIss,
  readDatesByVolume,
  readLibrary,
  updateLibrary,
  volumeState,
  withReadIss,
  readsByMonth,
  isFavouriteVolume,
  toggleFavouriteCreator,
  toggleFavouriteVolume,
  applyNextReleaseVol,
  applyVolumeTag,
  latestIssueDateByVolume,
  nextReleaseOf,
  volumeTagsOf,
  type Edition,
  editionProgress,
  createEdition,
  deleteEdition,
  applyEditionIssues,
  updateEdition,
  type EditionFormat,
  editionsByIssue,
  bestEdition,
  editionCoverId,
} from "./library.ts";
import { advanceRelease, resolveNextRelease } from "./release.ts";
import {
  searchCreatorIssues,
  searchCreators,
  type IssueFilter,
} from "./search.ts";
import {
  getCharacterContext,
  groupCharacterIssues,
  matchCharacters,
  readIssuesOf,
} from "./character.ts";
import { serveUi } from "./server-ui.ts";
import {
  getIndexJob,
  startReadIndexJob,
  startVolumeIndexJob,
} from "./index-job.ts";
import { getVolumeYaml } from "./vault.ts";
import { isValidSession, readCookie, signSession } from "./session.ts";
import { buildHistoryCsv, type HistoryCsvRow } from "./export.ts";

const PORT = Number(process.env.PORT) || 3001;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────── Access control ─────────────
// Set APP_PASSWORD to require HTTP Basic auth on every route, UI and API.
// Unset (local development) leaves the app open. The password lives in the
// server process only; it is never bundled into or sent to the browser.
const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
const MAX_AGE = 90 * 24 * 60 * 60;
const isAuthorized = (req: IncomingMessage, res: ServerResponse): boolean => {
  if (!APP_PASSWORD) return true;
  const cookie = readCookie(req.headers.cookie, "comiclib_session");
  if (isValidSession(cookie, APP_PASSWORD, Date.now())) return true;
  if (!req.headers.authorization?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(
    req.headers.authorization.slice(6),
    "base64",
  ).toString("utf8");
  const given = Buffer.from(decoded.slice(decoded.indexOf(":") + 1));
  const expected = Buffer.from(APP_PASSWORD);
  const ok =
    given.length === expected.length && timingSafeEqual(given, expected);
  if (!ok) return false;
  const token = signSession(APP_PASSWORD, Date.now() + MAX_AGE * 1000);
  res.setHeader(
    "Set-Cookie",
    `comiclib_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`,
  );
  return true;
};

// ───────────── Helper functions ─────────────
const EDITION_FORMATS = [
  "single",
  "trade",
  "hc",
  "compact",
  "omnibus",
  "compendium",
] as const satisfies readonly EditionFormat[];

// Returns a clean value, or a string error message for the route to 400 with.
const parseEditionBody = (
  body: any,
  requireName: boolean,
):
  | {
      name?: string;
      format?: EditionFormat;
      owned?: boolean;
      coverId?: number | undefined;
    }
  | string => {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  const result: {
    name?: string;
    format?: EditionFormat;
    owned?: boolean;
    coverId?: number | undefined;
  } = {};

  // name — if present it must be a string; trim it; if requireName, reject empty
  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return "Name must be a string";
    }
    const trimmed = body.name.trim();
    if (requireName && trimmed === "") {
      return "Name cannot be empty";
    }
    result.name = trimmed;
  } else if (requireName) {
    return "Name is required";
  }

  // format — if present it must be in EDITION_FORMATS; if requireName (create), default to "trade"
  if (body.format !== undefined) {
    if (
      typeof body.format !== "string" ||
      !(EDITION_FORMATS as readonly string[]).includes(body.format)
    )
      return `Format must be one of: ${EDITION_FORMATS.join(", ")}`;
    result.format = body.format as EditionFormat;
  } else if (requireName) {
    result.format = "trade";
  }
  // owned — if present it must be a boolean

  if (body.owned !== undefined) {
    if (typeof body.owned !== "boolean")
      return `Owned must be either true or false`;
    result.owned = body.owned;
  } else if (requireName) {
    result.owned = false;
  }

  // coverId must be postiive integer
  if (body.coverId != null) {
    if (
      typeof body.coverId !== "number" ||
      !Number.isInteger(body.coverId) ||
      body.coverId <= 0
    )
      return "CoverId must be a positive integer";
    result.coverId = body.coverId;
  }

  return result;
};

const parseBulkIssuesBody = (
  body: any,
): { add: number[]; remove: number[] } | string => {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  let add: number[] = [];
  if (body.add !== undefined) {
    if (!Array.isArray(body.add)) {
      return "'add' must be an array";
    }
    add = body.add
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n > 0);
  }

  let remove: number[] = [];
  if (body.remove !== undefined) {
    if (!Array.isArray(body.remove)) {
      return "'remove' must be an array";
    }
    remove = body.remove
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n > 0);
  }

  return { add, remove };
};

const parseRole = (value: string | null): IssueFilter["role"] =>
  value === "writer" || value === "artist" || value === "cover" ? value : "all";

const parseIds = (value: string | null): Set<number> =>
  new Set(
    (value ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0),
  );

const readJson = (req: IncomingMessage): Promise<any> =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });

createServer(async (req, res) => {
  try {
    if (!isAuthorized(req, res)) {
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="ComicLib", charset="UTF-8"',
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("Authentication required");
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    // ───────────── Catalogue ──────────────
    // Getting volume index of the Publisher
    if (url.pathname === "/api/volumes") {
      const volumes = await getVolumeIndex();
      send(res, 200, volumes);
      return;
    }
    // Force-fetching publisher index
    if (url.pathname === "/api/volumes/refresh" && req.method === "POST") {
      const volumes = await getVolumeIndex(10, true);
      send(res, 200, volumes);
      return;
    }
    // List of IDs of already cached volumes, for Discovery Page
    if (url.pathname === "/api/cached-volume-ids") {
      const volumeIds = await listCachedVolumeIds();
      send(res, 200, volumeIds);
      return;
    }
    // Selecting a state (ongoing, ignored, reading) for a volume
    if (url.pathname === "/api/library/volume-flags") {
      const lib = readLibrary();
      const ids = (
        pick: (e: {
          ongoing?: true;
          ignored?: true;
          reading?: true;
        }) => boolean,
      ) =>
        Object.entries(lib.volumes)
          .filter(([, e]) => pick(e))
          .map(([id]) => Number(id));
      send(res, 200, {
        ignored: ids((e) => e.ignored === true),
        reading: ids((e) => e.reading === true),
        ongoing: ids((e) => e.ongoing === true),
      });
      return;
    }

    // ───────────── Volume & Issue Browsing ──────────────
    // Volume Details, summaries, read dates
    const volumeMatch = url.pathname.match(/^\/api\/volume\/(\d+)$/);
    if (volumeMatch) {
      const { volume, summaries } = await getVolume(Number(volumeMatch[1]));
      const lib = readLibrary();
      const detailIds = await listCachedIssueIds();
      const dates = readDatesByVolume(lib, summaries).get(volume.id) ?? {
        firstReadAt: null,
        lastReadAt: null,
      };
      const fallbackCover =
        summaries.find((s) => s.coverImage)?.coverImage ?? "";
      const lastIssueDate =
        latestIssueDateByVolume(summaries).get(volume.id) ?? null;
      const nextReleaseOverride = nextReleaseOf(lib, volume.id);

      const body = {
        volume: { ...volume, coverImage: volume.coverImage || fallbackCover },
        summaries: withReadIss(summaries, lib),
        detailsCached: summaries.filter((s) => detailIds.has(s.id)).length,
        reading: isReadingVol(lib, volume.id),
        ignored: isIgnoredVol(lib, volume.id),
        ongoing: isOngoingVol(lib, volume.id),
        firstReadAt: dates.firstReadAt,
        lastReadAt: dates.lastReadAt,
        favourite: isFavouriteVolume(lib, volume.id),
        nextRelease: resolveNextRelease(
          lastIssueDate,
          nextReleaseOverride,
          localToday(),
        ),
        nextReleaseOverride: nextReleaseOverride ?? null,
        tags: volumeTagsOf(lib, volume.id),
      };
      send(res, 200, body);
      return;
    }

    // Getting issue detail
    const issueMatch = url.pathname.match(
      /^\/api\/volume\/(\d+)\/issues\/(\d+)$/,
    );
    if (issueMatch) {
      const volumeId = Number(issueMatch[1]);
      const issue = await getIssueFromVolume(volumeId, Number(issueMatch[2])); // may throw - nothing sent yet

      const { summaries } = await getVolume(volumeId); // cached
      const ordered = [...summaries].sort(
        (a, b) => a.issueNumber - b.issueNumber,
      );
      const index = ordered.findIndex((s) => s.id === issue.id);
      const neighbor = (s: (typeof ordered)[number] | undefined) =>
        s ? { id: s.id, issueNumber: s.issueNumber } : null;

      send(res, 200, {
        ...issue,
        readAt: readAtOfIss(readLibrary(), issue.id) ?? null,
        prevIssue: index > 0 ? neighbor(ordered[index - 1]) : null,
        nextIssue:
          index >= 0 && index < ordered.length - 1
            ? neighbor(ordered[index + 1])
            : null,
      });
      return;
    }
    // POST /api/volume/:vid/issues/:iid/refresh
    // Force-feshing issue detail, for when the Issue missed details on initial pull
    const refreshIssue = url.pathname.match(
      /^\/api\/volume\/(\d+)\/issues\/(\d+)\/refresh$/,
    );
    if (refreshIssue && req.method === "POST") {
      const volumeId = Number(refreshIssue[1]);
      const issueId = Number(refreshIssue[2]);

      const { summaries } = await getVolume(volumeId); // cached, no request
      const summary = summaries.find((s) => s.id === issueId);

      if (!summary) {
        send(res, 404, {
          error: `issue ${issueId} is not in volume ${volumeId}`,
        });
        return;
      }

      const issue = await refreshIssueDetail(summary);
      send(res, 200, issue);
      return;
    }
    // Forgetting an Issue - added in case of wanting to clear cache of unnecessary data
    const detailMatch = url.pathname.match(/^\/api\/issue\/(\d+)\/cache$/);
    if (detailMatch && req.method === "DELETE") {
      const deleted = await deleteIssueDetail(Number(detailMatch[1]));
      send(res, 200, { deleted });
      return;
    }

    // ───────────── Library Reads ──────────────

    // Cached Volumes and it's data - Used for Gallery, Shelf and History pages
    if (url.pathname === "/api/library") {
      const lib = readLibrary();
      const volumes = await listCachedVolumes();
      const summaries = await listCachedSummaries();
      const progress = progressByVolume(lib, summaries);
      const dates = readDatesByVolume(lib, summaries);
      const latestDates = latestIssueDateByVolume(summaries);
      const today = localToday();
      const coverByVolume = new Map<number, string>();
      for (const s of summaries) {
        if (s.coverImage && !coverByVolume.has(s.volumeId)) {
          coverByVolume.set(s.volumeId, s.coverImage);
        }
      }
      const rows = volumes.map((v) => {
        const { characters: _characters, ...volume } = v;
        const p = progress.get(v.id) ?? { pulled: 0, read: 0 };
        const total = Math.max(v.numberOfIssues, p.pulled);
        const d = dates.get(v.id) ?? { firstReadAt: null, lastReadAt: null };

        const reading = isReadingVol(lib, v.id);
        const ongoing = isOngoingVol(lib, v.id);
        return {
          ...volume,
          numberOfIssues: total,
          coverImage: v.coverImage || coverByVolume.get(v.id) || "",
          issuesKnown: p.pulled,
          read: p.read,
          firstReadAt: d.firstReadAt,
          lastReadAt: d.lastReadAt,
          reading,
          ongoing,
          ignored: isIgnoredVol(lib, v.id),
          state: volumeState(p.read, total, reading, ongoing),
          favourite: isFavouriteVolume(lib, v.id),
          nextRelease: ongoing
            ? resolveNextRelease(
                latestDates.get(v.id) ?? null,
                nextReleaseOf(lib, v.id),
                today,
              )
            : { date: null, source: "none" as const },
          tags: volumeTagsOf(lib, v.id),
        };
      });
      send(res, 200, rows);
      return;
    }

    // Groups read issues by month
    if (url.pathname === "/api/history/monthly") {
      const lib = readLibrary();
      const summaries = await listCachedSummaries();
      const volumes = await listCachedVolumes();
      const volumeById = new Map(volumes.map((v) => [v.id, v]));

      const byIssue = editionsByIssue(lib);
      const editionOf = (id: number) => bestEdition(byIssue.get(id) ?? []);
      const byMonth = readsByMonth(lib, summaries, editionOf);
      const summariesById = new Map(summaries.map((s) => [s.id, s]));

      const rows = [...byMonth.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, counts]) => {
          const items = [...counts.values()]
            .map((group) => {
              const isEdition = group.kind === "edition";
              const volume = isEdition ? undefined : volumeById.get(group.id);
              const cover =
                group.issues
                  .map((issue) => summariesById.get(issue.id)?.coverImage)
                  .find((c) => c) ?? "";

              const issues = group.issues
                .map((issue) => ({
                  ...issue,
                  volumeName:
                    volumeById.get(issue.volumeId)?.name ??
                    `Volume ${issue.volumeId}`,
                }))
                .sort(
                  (a, b) =>
                    a.volumeName.localeCompare(b.volumeName) ||
                    a.volumeId - b.volumeId ||
                    a.issueNumber - b.issueNumber,
                );

              const edition = isEdition ? lib.editions[group.id] : undefined;
              const chosenCover = edition
                ? summariesById.get(editionCoverId(edition) ?? -1)?.coverImage
                : "";

              return {
                id: group.id,
                kind: group.kind,
                name: isEdition
                  ? (lib.editions[group.id]?.name ?? `Edition ${group.id}`)
                  : (volume?.name ?? `Volume ${group.id}`),
                coverImage: isEdition
                  ? (chosenCover || cover)
                  : (volume?.coverImage ?? ""),
                count: group.issues.length,
                issues,
              };
            })
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

          return {
            month,
            total: items.reduce((sum, v) => sum + v.count, 0),
            groups: items,
          };
        });

      send(res, 200, rows);
      return;
    }

    if (url.pathname === "/api/history/export.csv" && req.method === "GET") {
      const lib = readLibrary();
      const summaries = await listCachedSummaries();
      const volumes = await listCachedVolumes();
      const volumeById = new Map(volumes.map((v) => [v.id, v]));
      const summariesById = new Map(summaries.map((s) => [s.id, s]));
      const byMonth = readsByMonth(lib, summaries);

      const rows: HistoryCsvRow[] = [...byMonth.entries()].flatMap(
        ([month, counts]) =>
          [...counts.values()].flatMap((group) => {
            return group.issues.map((issue) => ({
              month,
              volume:
                volumeById.get(issue.volumeId)?.name ??
                `Volume ${issue.volumeId}`,
              issue: issue.issueNumber,
              releaseDate: summariesById.get(issue.id)?.datePublished ?? "",
              readAt: issue.readAt,
            }));
          }),
      );

      const csv = buildHistoryCsv(rows);

      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="comiclib-history.csv"',
        "Cache-Control": "no-store",
      });
      res.end(csv);
      return;
    }

    // ───────────── Library Writes ──────────────

    // Applying 'read' or unread to multiple issues of the volume at once
    if (url.pathname === "/api/library/issues/bulk" && req.method === "POST") {
      const body = await readJson(req);
      const date = typeof body.date === "string" ? body.date : localToday();
      if (!isISODate(date)) {
        send(res, 400, { error: "bad date" });
        return;
      }
      const read = Array.isArray(body.read) ? body.read.map(Number) : [];
      const unread = Array.isArray(body.unread) ? body.unread.map(Number) : [];
      if (read.length === 0 && unread.length === 0) {
        send(res, 400, { error: "nothing selected" });
        return;
      }
      const lib = updateLibrary((lib) => {
        applyBulkRead(lib, read, date);
        clearBulkRead(lib, unread);
      });
      send(res, 200, lib);
      return;
    }
    // Marking read on singular issue
    const readMatch = url.pathname.match(
      /^\/api\/library\/issue\/(\d+)\/read$/,
    );
    if (readMatch && req.method === "POST") {
      const date = url.searchParams.get("date") ?? localToday();
      if (!isISODate(date)) {
        send(res, 400, { error: "bad date" });
        return;
      }
      const lib = updateLibrary((lib) =>
        applyReadIss(lib, Number(readMatch[1]), date),
      );
      send(res, 200, lib);
      return;
    }
    // Marking unread on singular issue
    const unreadMatch = url.pathname.match(
      /^\/api\/library\/issue\/(\d+)\/unread$/,
    );
    if (unreadMatch && req.method === "POST") {
      const lib = updateLibrary((lib) =>
        clearReadIss(lib, Number(unreadMatch[1])),
      );
      send(res, 200, lib);
      return;
    }

    // Marking every issue in the volume read
    const readAllMatch = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/read-all$/,
    );
    if (readAllMatch && req.method === "POST") {
      const date = url.searchParams.get("date") ?? localToday();
      if (!isISODate(date)) {
        send(res, 400, { error: "bad date" });
        return;
      }
      const { summaries } = await getVolume(Number(readAllMatch[1]));
      const lib = updateLibrary((lib) => {
        applyBulkRead(
          lib,
          summaries.map((s) => s.id),
          date,
        );
      });
      send(res, 200, { count: summaries.length, library: lib });
      return;
    }

    // Applying reading/ongoing/ignored flags to Volume ───────────────
    const volumeSetReading = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/reading$/,
    );
    if (volumeSetReading && req.method === "POST") {
      const lib = updateLibrary((lib) =>
        applyReadingVol(lib, Number(volumeSetReading[1]), true),
      );
      send(res, 200, lib);
      return;
    }

    const volumeNotRead = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/not-reading$/,
    );
    if (volumeNotRead && req.method === "POST") {
      const lib = updateLibrary((lib) =>
        applyReadingVol(lib, Number(volumeNotRead[1]), false),
      );
      send(res, 200, lib);
      return;
    }

    const volumeOngoing = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/ongoing$/,
    );
    if (volumeOngoing && req.method === "POST") {
      const lib = updateLibrary((lib) =>
        applyOngoingVol(lib, Number(volumeOngoing[1]), true),
      );
      send(res, 200, lib);
      return;
    }

    const volumeNotOngoing = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/not-ongoing$/,
    );
    if (volumeNotOngoing && req.method === "POST") {
      const lib = updateLibrary((lib) =>
        applyOngoingVol(lib, Number(volumeNotOngoing[1]), false),
      );
      send(res, 200, lib);
      return;
    }

    const volumeIgnore = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/ignore$/,
    );
    if (volumeIgnore && req.method === "POST") {
      const lib = updateLibrary((lib) =>
        applyIgnoredVol(lib, Number(volumeIgnore[1]), true),
      );
      send(res, 200, lib);

      return;
    }

    const volumeUnignore = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/unignore$/,
    );
    if (volumeUnignore && req.method === "POST") {
      const lib = updateLibrary((lib) =>
        applyIgnoredVol(lib, Number(volumeUnignore[1]), false),
      );
      send(res, 200, lib);

      return;
    }

    // Forgetting a volume and all of it's details ─── Important: doesn't delete user data (read statuses), just affects cache
    const delMatch = url.pathname.match(/^\/api\/library\/(\d+)$/);
    if (delMatch && req.method === "DELETE") {
      const removed = await deleteVolume(Number(delMatch[1]));
      send(res, 200, removed);
      return;
    }

    // ────── Refresh ──────
    // Volume Page - forcing the refresh in case of new issues
    const refreshOne = url.pathname.match(/^\/api\/library\/refresh\/(\d+)$/);
    if (refreshOne && req.method === "POST") {
      const result = await refreshVolume(Number(refreshOne[1]), true);
      send(res, 200, result);
      return;
    }

    // Mass refreshing in Shelf for ongoing titles in case of updates.
    if (url.pathname === "/api/library/refresh" && req.method === "POST") {
      const lib = readLibrary();
      const cachedIds = new Set(await listCachedVolumeIds());
      const ids = Object.entries(lib.volumes)
        .filter(([id, v]) => v.ongoing === true && cachedIds.has(Number(id)))
        .map(([id]) => Number(id));
      const results = [];
      for (const [i, id] of ids.entries()) {
        results.push(await refreshVolume(id));
        if (i < ids.length - 1) await sleep(250); // one probe per volume, paced
      }
      send(res, 200, results);
      return;
    }
    // ────── Favourites ──────
    const favVolume = url.pathname.match(/^\/api\/favourites\/volume\/(\d+)$/);
    if (favVolume && req.method === "POST") {
      let favourite = false;
      updateLibrary((lib) => {
        favourite = toggleFavouriteVolume(lib, Number(favVolume[1]));
      });
      send(res, 200, { favourite });
      return;
    }

    const favCreator = url.pathname.match(
      /^\/api\/favourites\/creator\/(\d+)$/,
    );
    if (favCreator && req.method === "POST") {
      let favourite = false;
      updateLibrary((lib) => {
        favourite = toggleFavouriteCreator(lib, Number(favCreator[1]));
      });
      send(res, 200, { favourite });
      return;
    }

    // Next release override for an ongoing volume (empty date clears it)
    const nextReleaseVol = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/next-release$/,
    );
    if (nextReleaseVol && req.method === "POST") {
      const body = await readJson(req);
      const volumeId = Number(nextReleaseVol[1]);

      // "Advance" moves the derived/stored date on by one release.
      if (body.advance === true) {
        const { summaries } = await getVolume(volumeId);
        const lastIssueDate =
          latestIssueDateByVolume(summaries).get(volumeId) ?? null;
        const current = resolveNextRelease(
          lastIssueDate,
          nextReleaseOf(readLibrary(), volumeId),
          localToday(),
        ).date;
        const next = current ? advanceRelease(current, localToday()) : null;
        const lib = updateLibrary((lib) =>
          applyNextReleaseVol(lib, volumeId, next),
        );
        send(res, 200, {
          nextReleaseOverride: nextReleaseOf(lib, volumeId) ?? null,
        });
        return;
      }

      const raw = typeof body.date === "string" ? body.date.trim() : "";
      if (raw && !isISODate(raw)) {
        send(res, 400, { error: "bad date" });
        return;
      }
      const lib = updateLibrary((lib) =>
        applyNextReleaseVol(lib, volumeId, raw || null),
      );
      send(res, 200, {
        nextReleaseOverride: nextReleaseOf(lib, volumeId) ?? null,
      });
      return;
    }

    // Volume tags — era/continuity judgments stored in the overlay
    const volumeTags = url.pathname.match(
      /^\/api\/library\/volume\/(\d+)\/tags$/,
    );
    if (volumeTags && req.method === "POST") {
      const body = await readJson(req);
      const add = typeof body.add === "string" ? body.add : "";
      const remove = typeof body.remove === "string" ? body.remove : "";
      if (!add.trim() && !remove.trim()) {
        send(res, 400, { error: "tag required" });
        return;
      }
      const volumeId = Number(volumeTags[1]);
      let tags: string[] = [];
      updateLibrary((lib) => {
        tags = add.trim()
          ? applyVolumeTag(lib, volumeId, add, true)
          : applyVolumeTag(lib, volumeId, remove, false);
      });
      send(res, 200, { tags });
      return;
    }

    // Gets a list of all editions
    if (url.pathname === "/api/editions" && req.method === "GET") {
      const lib = readLibrary();
      const editions = lib.editions;
      const body = [];
      const summaries = await listCachedSummaries();
      const summariesById = new Map(summaries.map((s) => [s.id, s]));

      for (const e of Object.values(editions)) {
        const { read, total } = editionProgress(lib, e);
        body.push({
          id: e.id,
          name: e.name,
          format: e.format,
          owned: e.owned,
          read,
          total,
          coverImage:
            summariesById.get(editionCoverId(e) ?? -1)?.coverImage ?? "",
        });
      }
      send(res, 200, body);
      return;
    }

    // Gets a detail for specific edition
    const editionFetch = url.pathname.match(/^\/api\/editions\/(\d+)$/);
    if (editionFetch && req.method === "GET") {
      const lib = readLibrary();
      const edition = lib.editions[Number(editionFetch[1])];
      if (!edition) {
        send(res, 404, { error: "edition not found" });
        return;
      }

      const summaries = await listCachedSummaries();
      const volumes = await listCachedVolumes();
      const volumeById = new Map(volumes.map((v) => [v.id, v]));
      const summariesById = new Map(summaries.map((s) => [s.id, s]));

      const issues = edition.issues.map((id) => {
        const s = summariesById.get(id);
        return {
          id,
          volumeId: s?.volumeId ?? null,
          volumeName: s
            ? (volumeById.get(s.volumeId)?.name ?? `Volume ${s.volumeId}`)
            : null,
          issueNumber: s?.issueNumber ?? null,
          datePublished: s?.datePublished ?? null,
          readAt: readAtOfIss(lib, id) ?? null,
          coverImage: s?.coverImage ?? null,
        };
      });

      issues.sort(
        (a, b) =>
          (a.volumeName ?? "\uffff").localeCompare(b.volumeName ?? "\uffff") ||
          (a.volumeId ?? 0) - (b.volumeId ?? 0) ||
          (a.issueNumber ?? 0) - (b.issueNumber ?? 0),
      );

      send(res, 200, {
        ...edition,
        ...editionProgress(lib, edition),
        coverId: editionCoverId(edition) ?? null,
        coverImage:
          summariesById.get(editionCoverId(edition) ?? -1)?.coverImage ?? "",
        issues,
      });
      return;
    }

    // Create Edition
    if (url.pathname === "/api/editions" && req.method === "POST") {
      const rawBody = await readJson(req);
      const parsed = parseEditionBody(rawBody, true);

      // 1. If parseEditionBody returns a string, it's a validation error -> 400
      if (typeof parsed === "string") {
        send(res, 400, { error: parsed });
        return;
      }

      let created: Edition | undefined;
      updateLibrary((lib) => {
        created = createEdition(lib, {
          name: parsed.name!,
          format: parsed.format ?? "trade",
          issues: [],
          owned: parsed.owned ?? false,
        });
      });

      send(res, 200, { created });
      return;
    }

    // Update edition
    const editEditions = url.pathname.match(/^\/api\/editions\/(\d+)$/);
    if (editEditions && req.method === "POST") {
      const rawBody = await readJson(req);
      const parsed = parseEditionBody(rawBody, false);

      // 1. If parseEditionBody returns a string, it's a validation error -> 400
      if (typeof parsed === "string") {
        send(res, 400, { error: parsed });
        return;
      }

      let updated: Edition | undefined = undefined;
      updateLibrary((lib) => {
        updated = updateEdition(lib, Number(editEditions[1]), {
          name: parsed.name,
          format: parsed.format,
          owned: parsed.owned,
          coverId: parsed.coverId,
        });
      });
      if (!updated) {
        send(res, 404, { error: "edition not found" });
        return;
      }

      send(res, 200, { updated });
      return;
    }

    // Add issues in bulk to edition
    const editionIssuesBulk = url.pathname.match(
      /^\/api\/editions\/(\d+)\/issues$/,
    );
    if (editionIssuesBulk && req.method === "POST") {
      const rawBody = await readJson(req);
      const parsed = parseBulkIssuesBody(rawBody);

      if (typeof parsed === "string") {
        send(res, 400, { error: parsed });
        return;
      }

      let updatedIssues;

      updateLibrary((lib) => {
        updatedIssues = applyEditionIssues(
          lib,
          Number(editionIssuesBulk[1]),
          parsed.add,
          parsed.remove,
        );
      });
      if (!updatedIssues) {
        send(res, 404, { error: "edition not found" });
        return;
      }
      send(res, 200, updatedIssues);
      return;
    }

    const editionDelete = url.pathname.match(/^\/api\/editions\/(\d+)$/);
    if (editionDelete && req.method === "DELETE") {
      let deleted = false;
      updateLibrary((lib) => {
        deleted = deleteEdition(lib, Number(editionDelete[1]));
      });
      if (!deleted) {
        send(res, 404, { error: "edition not found" });
        return;
      }
      send(res, 200, { deleted });
      return;
    }

    // ────── Creator Search ──────
    // Creator matching + coverage
    if (url.pathname === "/api/search/creators") {
      const query = url.searchParams.get("q") ?? "";
      const favOnly = url.searchParams.get("favourite") === "1";
      const role = parseRole(url.searchParams.get("role"));
      send(res, 200, await searchCreators(query, role, favOnly));
      return;
    }

    // Creator issues grouped by volume
    if (url.pathname === "/api/search/issues") {
      const creatorId = Number(url.searchParams.get("creator"));
      if (!Number.isInteger(creatorId) || creatorId <= 0) {
        send(res, 400, { error: "creator id required" });
        return;
      }

      const role = parseRole(url.searchParams.get("role"));

      const filter: IssueFilter = {
        readOnly: url.searchParams.get("read") !== "0",
        role,
      };

      const result = await searchCreatorIssues(creatorId, filter);
      if (!result) {
        send(res, 404, { error: "creator not found" });
        return;
      }

      send(res, 200, result);
      return;
    }

    // Read-index job - for launching a mass caching for issues I've set as read but haven't pulled the issue details for
    if (url.pathname === "/api/index/read") {
      if (req.method === "POST") {
        send(res, 202, await startReadIndexJob());
        return;
      }
      send(res, 200, getIndexJob());
      return;
    }

    if (url.pathname === "/api/index/status" && req.method === "GET") {
      send(res, 200, getIndexJob());
      return;
    }

    const jobUrl = url.pathname.match(/^\/api\/index\/volume\/(\d+)$/);
    if (jobUrl && req.method === "POST") {
      const result = await startVolumeIndexJob(Number(jobUrl[1]));
      if (!result.started) {
        if (result.busy) {
          send(res, 409, {
            error: "Another index job is running",
            job: result.job,
          });
        } else {
          send(res, 500, {
            error: result.job.error ?? "Could not start deep fetch",
            job: result.job,
          });
        }
        return;
      }

      send(res, 202, result.job);
      return;
    }
    //  ────── Character Search ──────

    // Character Detail - and how many volumes it appears in
    const charMatch = url.pathname.match(/^\/api\/character\/(\d+)$/);
    if (charMatch) {
      const character = await getCharacter(Number(charMatch[1]));
      const charCtx = await getCharacterContext();
      const entry = charCtx.index.get(character.id);
      send(res, 200, {
        ...character,
        issueCount: entry?.issueIds.size ?? 0,
        readCount: entry ? readIssuesOf(entry, charCtx.lib) : 0,
      });
      return;
    }

    // Name/alias match
    if (url.pathname === "/api/characters/search") {
      const query = url.searchParams.get("q") ?? "";
      const charCtx = await getCharacterContext();
      send(res, 200, matchCharacters(charCtx, query));
      return;
    }

    // Listing character issues, grouped by volume
    if (url.pathname === "/api/characters/issues") {
      const a = parseIds(url.searchParams.get("a"));
      if (a.size === 0) {
        send(res, 400, { error: "character a required" });
        return;
      }

      const bSet = parseIds(url.searchParams.get("b"));
      const b = bSet.size > 0 ? bSet : undefined;

      const charCtx = await getCharacterContext();
      send(res, 200, groupCharacterIssues(charCtx, a, b));
      return;
    }

    // Cached character details and issue counts
    if (url.pathname === "/api/characters/cached") {
      const [characters, charCtx] = await Promise.all([
        listCachedCharacters(),
        getCharacterContext(),
      ]);

      const rows = characters
        .map((character) => {
          const entry = charCtx.index.get(character.id);
          return {
            ...character,
            issueCount: entry?.issueIds.size ?? 0,
            readCount: entry ? readIssuesOf(entry, charCtx.lib) : 0,
          };
        })
        .sort(
          (a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name),
        );
      send(res, 200, rows);
      return;
    }

    //  ────── YAML Export ──────
    const yamlURL = url.pathname.match(/^\/api\/volume\/(\d+)\/export$/);
    if (yamlURL && req.method === "GET") {
      const result = await getVolumeYaml(Number(yamlURL[1]));
      send(res, 200, result);
      return;
    }

    const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");

    if (!isApi && (req.method === "GET" || req.method === "HEAD")) {
      serveUi(req, res, url.pathname);
      return;
    }

    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: String(e) });
  }
}).listen(PORT, "0.0.0.0", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`App on ${url}`);

  if (process.env.OPEN_BROWSER === "1") {
    const open =
      process.platform === "win32"
        ? `start "" "${url}"`
        : process.platform === "darwin"
          ? `open "${url}"`
          : `xdg-open "${url}"`;

    exec(open, () => {});
  }
});
