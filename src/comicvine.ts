// ─── comicvine.ts — the API layer ─────────────────────────────────────────
// Layers, top to bottom: config/helpers → types → env → HTTP fetchers →
// transforms → disk cache → UI surface → background job → demo.

import { type Character, type Issue, type Volume } from "./model.ts";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdir,
} from "node:fs";
import { dirname } from "node:path";
import { rolesOf } from "./credits.ts";

// ─── config & role helpers ───────────────────────────────────────────────
const CACHE_DIR = process.env.CACHE_DIR ?? "cache";
mkdirSync(CACHE_DIR, { recursive: true });

// Delay between API Requests - API limited to 200 rquests/h
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = 18_000; // 18s for sustained pulls

// ─── types ───────────────────────────────────────────────────────────────

export type IssueSummary = {
  id: number; // key to link connections
  volumeId: number; // id linking Volume and Issue
  issueNumber: number;
  datePublished: string; // ex. 2022-10-01
  coverImage: string; // ling to the cover img url
  name: string;
};

// ─── env ─────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing — check .env and --env-file`);
  return value;
}
const assertOk = (body: any): any => {
  if (body.status_code !== 1)
    throw new Error(`ComicVine ${body.status_code}: ${body.error}`);
  return body;
};

const API_KEY = requireEnv("COMICVINE_API_KEY");

// ─── HTTP fetchers  ──────────────────────

// Getting all volumes for the publisher (DC)
const readPublisherAPI = async (publisherId = 10) => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    field_list: `id,name,volumes`,
  });
  const response = await fetch(
    `https://comicvine.gamespot.com/api/publisher/4010-${publisherId}/?${params}`,
  );
  if (!response.ok) throw new Error("Failed fetch");
  const body = await response.json();
  return assertOk(body);
};

// Read Volume info
const readVolumeAPI = async (id: number) => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    field_list: `id,aliases,characters,description,count_of_issues,date_last_updated,image,name,start_year`,
  });
  const response = await fetch(
    `https://comicvine.gamespot.com/api/volume/4050-${id}/?${params}`,
  );
  if (!response.ok) throw new Error("Failed fetch");
  const body = await response.json();
  return assertOk(body);
};

// Checking if the volume got updated since we fetched it
const readVolumeProbe = async (id: number): Promise<any> => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    field_list: `id,count_of_issues,date_last_updated`,
  });
  const response = await fetch(
    `https://comicvine.gamespot.com/api/volume/4050-${id}/?${params}`,
  );
  if (!response.ok) throw new Error("Failed fetch");
  const body = await response.json();
  return assertOk(body);
};

// Read Character Info

const readCharacterAPI = async (id: number) => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    field_list: `id,name,deck,aliases,image,real_name,publisher,count_of_issue_appearances,first_appeared_in_issue,site_detail_url`,
  });
  const response = await fetch(
    `https://comicvine.gamespot.com/api/character/4005-${id}/?${params}`,
  );
  if (!response.ok) throw new Error("Failed fetch");
  const body = await response.json();
  return assertOk(body);
};

// Fetching list of issues of volume with pagination on (see getVolume)
const listIssuesFromVolume = async (
  volumeId: number,
  offset = 0,
  limit = 100,
): Promise<any> => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    filter: `volume:${volumeId}`,
    field_list: `id,name,store_date,cover_date,image,issue_number,volume`,
    offset: String(offset),
    limit: String(limit),
  });
  const response = await fetch(
    `https://comicvine.gamespot.com/api/issues/?${params}`,
  );
  if (!response.ok) throw new Error("Failed fetch");
  const body = await response.json();
  return assertOk(body);
};

// Get details about singular issue
const readIssue = async (issueId: number) => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    field_list: `id,name,store_date,cover_date,image,character_credits,description,person_credits`,
  });
  const response = await fetch(
    `https://comicvine.gamespot.com/api/issue/4000-${issueId}/?${params}`,
  );
  if (!response.ok) throw new Error("Failed fetch");
  const body = await response.json();
  return assertOk(body);
};

// ─── transforms — pure: raw in, typed out ──────────

// ComicVine descriptions are HTML - strip once
const stripTags = (html: string) => html.replace(/<[^>]*>/g, "");
const firstParagraph = (html: string) => stripTags(html.split("</p>")[0]);

// ComicVine uses img_broken.png when it has no image; treat it as "no cover".
const BROKEN_COVER = /img_broken\.png$/i;
const imageUrl = (image: any): string => {
  const url = image?.super_url ?? "";
  return BROKEN_COVER.test(url) ? "" : url;
};

// Summary from /issues call
const rawToIssueSummary = (issueRaw: any): IssueSummary => {
  let summIssue = {
    id: issueRaw.id,
    volumeId: issueRaw.volume.id,
    issueNumber: Number(issueRaw.issue_number),
    name: issueRaw.name ?? "",
    datePublished: issueRaw.store_date || issueRaw.cover_date || "",
    coverImage: imageUrl(issueRaw.image),
  };
  return summIssue;
};

// the mirror of rawToIssueSummary: the UI never sees snake_case
const rawToVolume = (raw: any): Volume => ({
  id: raw.id,
  name: raw.name ?? "",
  aliases: raw.aliases ? raw.aliases.split("\n") : [],
  numberOfIssues: Number(raw.count_of_issues) || 0,
  startYear: Number(raw.start_year) || 0,
  coverImage: imageUrl(raw.image),
  description: firstParagraph(raw.description ?? ""),
  characters: (raw.characters ?? [])
    .filter((character: any) => character?.id && character?.name)
    .map((character: any) => ({
      id: character.id,
      name: character.name,
      count: Number(character.count) || 0,
    })),
});

// Character Detail from /character call
const rawToCharacter = (raw: any): Character => ({
  id: raw.id,
  name: raw.name ?? "",
  realName: raw.real_name ?? "",
  aliases: raw.aliases
    ? raw.aliases
        .split(/\r?\n/)
        .map((alias: string) => alias.trim())
        .filter(Boolean)
    : [],
  deck: raw.deck ?? "",
  image: imageUrl(raw.image),
  publisher: raw.publisher?.name ?? "",
  firstAppearedIn: raw.first_appeared_in_issue?.name ?? "",
  globalAppearances: Number(raw.count_of_issue_appearances) || 0,
  siteUrl: raw.site_detail_url ?? "",
});

// Merging summaries with issue details - used when IssueSummary is missing the elements that IssueDetail contains
const mergeSummary = (summary: IssueSummary, detail: any): IssueSummary => ({
  ...summary,
  name: summary.name || detail.name || "",
  datePublished:
    summary.datePublished || detail.store_date || detail.cover_date || "",
  coverImage: summary.coverImage || imageUrl(detail.image),
});

const enrichSummary = (summary: IssueSummary): IssueSummary => {
  if (summary.name && summary.datePublished && summary.coverImage) {
    return summary;
  }
  const file = `${CACHE_DIR}/issue-${summary.id}.json`;
  if (!existsSync(file)) return summary;
  return mergeSummary(summary, JSON.parse(readFileSync(file, "utf8")).results);
};

// Details for singular issue, merged with existing summary
const withCredits = (summary: IssueSummary, detail: any): Issue => ({
  ...mergeSummary(summary, detail),
  characters: (detail.character_credits ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
  })),
  credits: (detail.person_credits ?? [])
    .filter((p: any) => p?.id && p?.name)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      roles: rolesOf(p),
    })),
  tags: [],
});

// ─── disk cache — the only place that knows files ────────────────────────

// read-through: file exists → read it (free).
// Missing → run the fetcher ONCE, save the raw envelope verbatim, return it.

const cached = async (
  file: string,
  fetcher: () => Promise<any>,
  force = false,
): Promise<{ data: any; fromCache: boolean }> => {
  if (!force && existsSync(file))
    return { data: JSON.parse(readFileSync(file, "utf8")), fromCache: true };
  const data = await fetcher();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
  invalidateCache();
  return { data, fromCache: false };
};

let cacheVersion = 0;
const invalidateCache = () => {
  cacheVersion += 1;
};
const memo = new Map<string, { version: number; value: unknown }>();

const memoList = <T>(key: string, load: () => T): T => {
  const hit = memo.get(key);
  if (hit && hit.version === cacheVersion) return hit.value as T;
  const value = load();
  memo.set(key, { version: cacheVersion, value });
  return value;
};

// ─── UI surface — the four calls the app will use ────────────────────────
// Step 0: Get all volumes for the publisher (DC)

export const getVolumeIndex = async (publisherId = 10, force = false) => {
  const { data } = await cached(
    `${CACHE_DIR}/publisher-${publisherId}.json`,
    () => readPublisherAPI(publisherId),
    force,
  );
  return data.results.volumes; // [{ id, name, ... }] × ~9,730
};

// Step 1: click a volume → { volume record, all summaries }.
// The pagination loop: one page = one file = resumable for free.
// `while (true)` bc number of results unknown - the loop breaks if it encounters empty page
export const getVolume = async (volumeId: number) => {
  const { data: volEnvelope } = await cached(
    `${CACHE_DIR}/volume-${volumeId}.json`,
    () => readVolumeAPI(volumeId),
  );

  const LIMIT = 100;
  const pages: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await cached(
      `${CACHE_DIR}/volume-${volumeId}-issues-p${offset / LIMIT}.json`,
      () => listIssuesFromVolume(volumeId, offset, LIMIT),
    );
    pages.push(data);
    if (data.results.length === 0) break; // empty page: never loop forever
    offset += data.results.length;
    if (offset >= data.number_of_total_results) break;
  }
  const summaries = pages.flatMap((p) => p.results.map(rawToIssueSummary));
  const volume = rawToVolume(volEnvelope.results);

  return {
    volume: {
      ...volume,
      numberOfIssues: Math.max(volume.numberOfIssues, summaries.length),
    },
    summaries: summaries.map(enrichSummary),
  };
};

// Refresh an ongoing volume: one cheap probe, then re-fetch only if it changed.
// Never touches issue-<id>.json details — those are expensive deep-fetches.
export type VolumeRefresh = {
  volumeId: number;
  added: number;
  total: number;
};

export const refreshVolume = async (
  volumeId: number,
  force?: true,
): Promise<VolumeRefresh> => {
  const volumeFile = `${CACHE_DIR}/volume-${volumeId}.json`;
  const pageFile = `${CACHE_DIR}/volume-${volumeId}-issues-p0.json`;

  const oldListTotal = existsSync(pageFile)
    ? Number(
        JSON.parse(readFileSync(pageFile, "utf8")).number_of_total_results,
      ) || 0
    : 0;

  const probe = await listIssuesFromVolume(volumeId, 0, 1);
  const newListTotal = Number(probe.number_of_total_results) || 0;
  const countChanged = newListTotal !== oldListTotal;

  if (!countChanged && !force) {
    return { volumeId, added: 0, total: oldListTotal };
  }

  // The volume record can lag far behind the list; refresh it, but don't gate on it.
  await cached(volumeFile, () => readVolumeAPI(volumeId), true);

  const LIMIT = 100;
  let offset = 0;
  let pages = 0;
  while (true) {
    const { data } = await cached(
      `${CACHE_DIR}/volume-${volumeId}-issues-p${offset / LIMIT}.json`,
      () => listIssuesFromVolume(volumeId, offset, LIMIT),
      true,
    );
    pages += 1;
    if (data.results.length === 0) break;
    offset += data.results.length;
    if (offset >= data.number_of_total_results) break;
  }

  // Drop page files left over if the volume ever shrinks.
  const pageRe = new RegExp(`^volume-${volumeId}-issues-p(\\d+)\\.json$`);
  for (const f of readdirSync(CACHE_DIR)) {
    const m = f.match(pageRe);
    if (m && Number(m[1]) >= pages) rmSync(`${CACHE_DIR}/${f}`);
  }
  invalidateCache();
  return { volumeId, added: Math.max(0, offset - oldListTotal), total: offset };
};

// Refresh Issue details, pulls new

export const refreshIssueDetail = async (
  summary: IssueSummary,
): Promise<Issue> => {
  const { data } = await cached(
    `${CACHE_DIR}/issue-${summary.id}.json`,
    () => readIssue(summary.id),
    true,
  );
  return withCredits(summary, data.results);
};

// Step 2: click an issue → full Issue (one request, once ever).
export const getIssue = async (summary: IssueSummary): Promise<Issue> => {
  const { data } = await cached(`${CACHE_DIR}/issue-${summary.id}.json`, () =>
    readIssue(summary.id),
  );
  const record = data.results; // unwrap the envelope once, at the boundary
  if (record.id !== summary.id)
    throw new Error(`Pairing mismatch: ${summary.id} vs ${record.id}`);
  return withCredits(summary, record);
};

export const getIssueFromVolume = async (
  volumeId: number,
  issueId: number,
): Promise<Issue> => {
  const { summaries } = await getVolume(volumeId); // cache reads (this is why getVolume is safe here)
  const summary = summaries.find((s) => s.id === issueId);
  if (!summary)
    throw new Error(`issue ${issueId} is not in volume ${volumeId}`);
  return getIssue(summary);
};

// Returns all cached issues
export const loadIssues = async (
  summaries: IssueSummary[],
): Promise<Issue[]> => {
  const issues: Issue[] = [];
  for (const summary of summaries) {
    const file = `${CACHE_DIR}/issue-${summary.id}.json`;
    if (!existsSync(file)) continue; // not deep-fetched yet — skip, not error
    const envelope = JSON.parse(readFileSync(file, "utf8"));
    if (envelope.results.id !== summary.id)
      throw new Error(`Pairing mismatch: ${summary.id}`);
    issues.push(withCredits(summary, envelope.results));
  }
  return issues;
};

// Returns all cached volumes
export const listCachedVolumes = async (): Promise<Volume[]> =>
  memoList("volumes", () =>
  readdirSync(CACHE_DIR)
    .filter((f) => /^volume-\d+\.json$/.test(f))
    .map((f) =>
      rawToVolume(
        JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8")).results,
      ),
    ),
  );

// Deleting pulled volumes (for duplicates)
export const deleteVolume = async (volumeId: number) => {
  const files = readdirSync(CACHE_DIR);
  const own = files.filter((f) =>
    new RegExp(`^volume-${volumeId}(-issues-p\\d+)?\\.json$`).test(f),
  );
  const issueIds = own
    .filter((f) => f.includes("-issues-p"))
    .flatMap((f) =>
      JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8")).results.map(
        (r: any) => r.id,
      ),
    );
  const details = issueIds
    .map((id) => `issue-${id}.json`)
    .filter((f) => files.includes(f));
  for (const f of [...own, ...details]) rmSync(`${CACHE_DIR}/${f}`);
  invalidateCache();
  return { volumeFiles: own.length, issueFiles: details.length };
};

export const deleteIssueDetail = async (issueId: number): Promise<boolean> => {
  const file = `${CACHE_DIR}/issue-${issueId}.json`;
  if (!existsSync(file)) return false;
  rmSync(file);
  invalidateCache();

  return true;
};

export const deleteCharacterDetail = async (
  charId: number,
): Promise<boolean> => {
  const file = `${CACHE_DIR}/character-${charId}.json`;
  if (!existsSync(file)) return false;
  rmSync(file);
  invalidateCache();
  return true;
};

// For showing in Discovery which volumes are pulled already
export const listCachedVolumeIds = async (): Promise<number[]> =>
  readdirSync(CACHE_DIR)
    .filter((f) => /^volume-\d+\.json$/.test(f))
    .map((f) => Number(f.slice(7, -5)));

export const listCachedSummaries = async (): Promise<IssueSummary[]> => 
  memoList("issue-summaries", () => {
  const byId = new Map<number, IssueSummary>();
  for (const f of readdirSync(CACHE_DIR).filter((f) =>
    /^volume-\d+-issues-p\d+\.json$/.test(f),
  )) {
    for (const raw of JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8"))
      .results) {
      byId.set(raw.id, rawToIssueSummary(raw));
    }
  }
  return [...byId.values()];
});

export const listCachedIssueIds = async (): Promise<Set<number>> =>
  new Set(
    memoList("issue-ids", () =>
    readdirSync(CACHE_DIR)
      .filter((f) => /^issue-\d+\.json$/.test(f))
      .map((f) => Number(f.slice(6, -5))),
  ));

export const listCachedIssueDetails = async (): Promise<
  { id: number; detail: any }[]
> =>
  memoList("issue-details", () =>
  readdirSync(CACHE_DIR)
    .filter((f) => /^issue-\d+\.json$/.test(f))
    .map((f) => ({
      id: Number(f.slice(6, -5)),
      detail: JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8")).results,
    })));

export const listCachedCharacterDetails = async (): Promise<
  { id: number; detail: any }[]
> =>
  memoList("character-details", () =>
  readdirSync(CACHE_DIR)
    .filter((f) => /^character-\d+\.json$/.test(f))
    .map((f) => ({
      id: Number(f.slice("character-".length, -".json".length)),
      detail: JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8")).results,
    })));

export const listCachedCharacters = async (): Promise<Character[]> =>
  memoList("characters", () =>
  readdirSync(CACHE_DIR)
    .filter((f) => /^character-\d+\.json$/.test(f))
    .map((f) =>
      rawToCharacter(
        JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8")).results,
      ),
    ));

// ─── background job  ─────────────────────

// Grab details for a lot of summaries - for fetching all volume issues
export const fillIssueDetails = async (
  summaries: IssueSummary[],
  onProgress?: (done: number, total: number, fresh: number) => void,
): Promise<number> => {
  const total = summaries.length;
  let fresh = 0;
  for (const [i, summary] of summaries.entries()) {
    const { fromCache } = await cached(
      `${CACHE_DIR}/issue-${summary.id}.json`,
      () => readIssue(summary.id),
    );
    if (!fromCache) fresh++;
    onProgress?.(i + 1, total, fresh);
    if (!fromCache && i < total - 1) await sleep(DELAY_MS);
  }
  return fresh;
};

export const getCharacter = async (charId: number): Promise<Character> => {
  const { data: charEnvelope } = await cached(
    `${CACHE_DIR}/character-${charId}.json`,
    () => readCharacterAPI(charId),
  );
  const record = charEnvelope.results;
  if (record.id !== charId)
    throw new Error(`Pairing mismatch: ${charId} vs ${record.id}`);
  return rawToCharacter(record);
};
