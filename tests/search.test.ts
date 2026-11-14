import { describe, expect, it } from "vitest";
import {
  buildCreatorIndex,
  groupCreatorIssues,
  matchCreators,
  type CreatorEntry,
  type SearchContext,
} from "../src/search.ts";
import type { IssueSummary } from "../src/comicvine.ts";
import type { Volume } from "../src/model.ts";
import { emptyLibrary, toggleFavouriteCreator } from "../src/library.ts";

// ─── harness ─────────────────────────────────────────────────────────────
// Plain data typed by the production shapes. `issues` is the per-issue role
// map the whole feature depends on: { issueId: ["writer", "cover"] }.

const makeCreator = (
  id: number,
  name: string,
  issues: Record<number, string[]>,
): CreatorEntry => {
  const roleMap = new Map<number, Set<string>>();
  const roles = new Set<string>();

  for (const [issueId, list] of Object.entries(issues)) {
    roleMap.set(Number(issueId), new Set(list));
    for (const role of list) roles.add(role);
  }

  return { id, name, roles, issues: roleMap };
};

const makeSummary = (
  id: number,
  volumeId: number,
  issueNumber: number,
  extra: Partial<IssueSummary> = {},
): IssueSummary => ({
  id,
  volumeId,
  issueNumber,
  datePublished: "2020-01-01",
  coverImage: "",
  name: `Issue ${issueNumber}`,
  ...extra,
});

const makeVolume = (id: number, name: string): Volume => ({
  id,
  name,
  aliases: [],
  characters: [],
  numberOfIssues: 10,
  startYear: 2000,
  coverImage: "",
  description: "",
});

const makeSearchContext = (
  overrides: Partial<SearchContext> = {},
): SearchContext => ({
  index: new Map(),
  summariesById: new Map(),
  volumesById: new Map(),
  lib: emptyLibrary(),
  readIds: new Set(),
  coverage: { indexedRead: 0, readTotal: 0 },
  ...overrides,
});

// ─── buildCreatorIndex ───────────────────────────────────────────────────

describe("buildCreatorIndex", () => {
  it("indexes a person by id with roles and a per-issue role map", () => {
    const details = [
      {
        issueId: 1,
        detail: {
          person_credits: [{ id: 7, name: "Tom King", role: "writer" }],
        },
      },
    ];
    const validIds = new Set([1, 2]);
    const index = buildCreatorIndex(details, validIds);

    expect(index.get(7)?.roles).toEqual(new Set(["writer"]));
    expect(index.get(7)?.issues.get(1)).toEqual(new Set(["writer"]));
  });

  it("keeps a different role for each issue, not one role for the person", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "inker" }],
        },
      },
    ];
    const index = buildCreatorIndex(details, new Set([10, 11]));

    expect(index.get(7)?.roles).toEqual(new Set(["writer", "inker"]));
    expect(index.get(7)?.issues.get(10)).toEqual(new Set(["writer"]));
    expect(index.get(7)?.issues.get(11)).toEqual(new Set(["inker"]));
  });

  it("ignores issues that are not in validIssueIds", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([11]));
    expect(index.size).toBe(0);
  });

  it("skips credits with a missing id or name", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7 }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ name: "Writer Name" }],
        },
      },
      {
        issueId: 12,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10, 11, 12]));
    expect(index.size).toBe(1);
  });

  it("splits comma-joined roles into tokens", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [
            { id: 7, name: "Artist Name", role: "artist, cover" },
          ],
        },
      },
    ];
    const index = buildCreatorIndex(details, new Set([10]));
    expect(index.get(7)?.roles).toEqual(new Set(["artist", "cover"]));
  });
});

// ─── matchCreators ───────────────────────────────────────────────────────

describe("matchCreators", () => {
  it("counts only the issues where the person had the filtered role", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "inker" }],
        },
      },
    ];
    const index = buildCreatorIndex(details, new Set([10, 11]));
    const ctx = makeSearchContext({ index });
    const result = matchCreators(ctx, "", "writer");
    expect(result[0]?.issueCount).toBe(1);
  });

  it("treats cover as its own role, not an artist role", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [
            { id: 7, name: "Cover Name", role: "cover" },
            { id: 8, name: "Artist Name", role: "penciller" },
          ],
        },
      },
    ];
    const index = buildCreatorIndex(details, new Set([10]));
    const ctx = makeSearchContext({ index });
    const result = matchCreators(ctx, "", "artist");

    expect(result.length).toBe(1);
    expect(result.map((c) => c.roles)).toEqual([["penciller"]]);
  });

  it("counts read issues only among the filtered issues", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10, 11]));
    const ctx = makeSearchContext({ index, readIds: new Set([10]) });
    const results = matchCreators(ctx, "", "writer");

    expect(results.map((c) => c.readCount)).toEqual([1]);
    expect(results.map((c) => c.issueCount)).toEqual([2]);
  });

  it("keeps only favourites when favouriteOnly is true", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [
            { id: 7, name: "Cover Name", role: "cover" },
            { id: 8, name: "Artist Name", role: "penciller" },
          ],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10]));
    const lib = emptyLibrary();
    toggleFavouriteCreator(lib, 7);
    const ctx = makeSearchContext({ index, lib });
    const results = matchCreators(ctx, "", "all", true);

    expect(results.map((c) => c.id)).toEqual([7]);
  });

  it("sorts by read count, then name", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [
            { id: 1, name: "Zeta", role: "writer" },
            { id: 8, name: "Alpha", role: "penciller" },
          ],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 1, name: "Zeta", role: "writer" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10, 11]));
    const lib = emptyLibrary();
    const ctx = makeSearchContext({ index, lib, readIds: new Set([10, 11]) });
    const results = matchCreators(ctx, "", "all");

    expect(results.map((c) => c.name)).toEqual(["Zeta", "Alpha"]);
  });
});

// ─── groupCreatorIssues ──────────────────────────────────────────────────

describe("groupCreatorIssues", () => {
  it("returns null for an unknown creator", () => {
    const ctx = makeSearchContext();
    expect(
      groupCreatorIssues(ctx, 99, { readOnly: false, role: "all" }),
    ).toBeNull();
  });

  it("drops unread issues when readOnly is true", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10, 11]));
    const lib = emptyLibrary();
    lib.issues[10] = { readAt: "2026-01-05" };
    const ctx = makeSearchContext({
      index,
      lib,
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Some Volume")]]),
    });
    const results = groupCreatorIssues(ctx, 7, { readOnly: true, role: "all" });
    const all = groupCreatorIssues(ctx, 7, { readOnly: false, role: "all" });
    expect(all?.volumes[0].issues.map((i) => i.id)).toEqual([10, 11]);
    expect(results?.volumes).toHaveLength(1);
    expect(results?.volumes[0].issues.map((i) => i.id)).toEqual([10]);
  });

  it("filters issues by the role the person actually had there", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "inker" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10, 11]));
    const ctx = makeSearchContext({
      index,
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Some Volume")]]),
    });
    expect(
      groupCreatorIssues(ctx, 7, {
        readOnly: false,
        role: "writer",
      })?.volumes[0].issues.map((i) => i.id),
    ).toEqual([10]);
    expect(
      groupCreatorIssues(ctx, 7, {
        readOnly: false,
        role: "artist",
      })?.volumes[0].issues.map((i) => i.id),
    ).toEqual([11]);
  });

  it("computes roleGroups from the issue's roles", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [
            { id: 7, name: "Writer Name", role: "writer, cover" },
          ],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Cover Name", role: "penciller" }],
        },
      },
    ];
    const index = buildCreatorIndex(details, new Set([10, 11]));
    const ctx = makeSearchContext({
      index,
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Some Volume")]]),
    });

    const result = groupCreatorIssues(ctx, 7, { readOnly: false, role: "all" });
    const issues = result!.volumes[0].issues;

    expect(issues.map((i) => i.roles)).toEqual([
      ["cover", "writer"],
      ["penciller"],
    ]);
    expect(issues.map((i) => i.roleGroups)).toEqual([
      ["writer", "cover"],
      ["artist"],
    ]);
  });

  it("groups by volume and sorts issues and volumes", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "inker" }],
        },
      },
      {
        issueId: 12,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10, 11, 12]));
    const ctx = makeSearchContext({
      index,
      summariesById: new Map([
        [10, makeSummary(10, 2, 2)],
        [11, makeSummary(11, 2, 1)],
        [12, makeSummary(12, 1, 1)],
      ]),
      volumesById: new Map([
        [1, makeVolume(1, "Zeta")],
        [2, makeVolume(2, "Alpha")],
      ]),
    });
    const result = groupCreatorIssues(ctx, 7, { readOnly: false, role: "all" });

    const byName = new Map(result!.volumes.map((v) => [v.name, v]));

    expect(byName.get("Alpha")!.issues.map((i) => i.issueNumber)).toEqual([
      1, 2,
    ]);
    expect(byName.get("Zeta")!.issues.map((i) => i.issueNumber)).toEqual([1]);

    expect(result?.volumes.map((v) => v.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("maps readAt and leaves unread issues null", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "writer" }],
        },
      },
      {
        issueId: 11,
        detail: {
          person_credits: [{ id: 7, name: "Writer Name", role: "penciller" }],
        },
      },
    ];

    const index = buildCreatorIndex(details, new Set([10, 11]));
    const lib = emptyLibrary();
    lib.issues[10] = { readAt: "2026-01-05" };

    const ctx = makeSearchContext({
      index,
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Zeta")]]),
      lib,
    });
    const result = groupCreatorIssues(ctx, 7, { readOnly: false, role: "all" });
    const issues = result!.volumes[0].issues;

    expect(issues.map((i) => i.readAt)).toEqual(["2026-01-05", null]);
  });
});
