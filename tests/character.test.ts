import { describe, expect, it } from "vitest";
import {
  buildCharacterIndex,
  enrichCharacterIndex,
  groupCharacterIssues,
  matchCharacters,
  readIssuesOf,
  type CharacterContext,
  type CharacterEntry,
} from "../src/character.ts";
import type { IssueSummary } from "../src/comicvine.ts";
import type { Volume } from "../src/model.ts";
import { emptyLibrary } from "../src/library.ts";

// ─── harness ─────────────────────────────────────────────────────────────
// These build plain data typed by the production types. If a type changes,
// tsc flags the helper — it cannot silently drift the way a copied function
// can. Every test only states the part it cares about.

const makeEntry = (
  id: number,
  name: string,
  issueIds: number[],
  extra: Partial<CharacterEntry> = {},
): CharacterEntry => ({
  id,
  name,
  issueIds: new Set(issueIds),
  aliases: [],
  realName: "",
  image: "",
  deck: "",
  detailCached: false,
  ...extra,
});

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

const makeContext = (
  overrides: Partial<CharacterContext> = {},
): CharacterContext => ({
  index: new Map(),
  summariesById: new Map(),
  volumesById: new Map(),
  lib: emptyLibrary(),
  ...overrides,
});

// ─── buildCharacterIndex ─────────────────────────────────────────────────

describe("buildCharacterIndex", () => {
  it("credits a character with the issue that names it", () => {
    // Worked example: the shape of a cached issue detail.
    const details = [
      {
        issueId: 10,
        detail: {
          character_credits: [{ id: 1, name: "Nightwing" }],
        },
      },
    ];

    const index = buildCharacterIndex(details, new Set([10]));
    const entry = index.get(1);

    expect(entry?.name).toBe("Nightwing");
    expect(entry?.issueIds).toEqual(new Set([10]));
    expect(entry?.detailCached).toBe(false);
  });

  it("merges one character across several issues into one entry", () => {
    const details = [
      {
        issueId: 10, // Issue of id 10
        detail: {
          character_credits: [{ id: 1, name: "Nightwing" }],
        },
      },
      {
        issueId: 11,
        detail: {
          character_credits: [{ id: 1, name: "Nightwing" }],
        },
      },
    ];

    const index = buildCharacterIndex(details, new Set([10, 11]));

    expect(index.size).toBe(1); // one character, not two
    expect(index.get(1)?.issueIds).toEqual(new Set([10, 11])); // both issues
  });

  it("ignores issues that are not in validIssueIds", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          character_credits: [{ id: 1, name: "Nightwing" }],
        },
      },
    ];

    const index = buildCharacterIndex(details, new Set([11]));
    expect(index.size).toBe(0);
  });

  it("skips credits with a missing id or name", () => {
    const details = [
      {
        issueId: 1,
        detail: {
          character_credits: [{ id: 1 }],
        },
      },
      {
        issueId: 2,
        detail: {
          character_credits: [{ name: "Nightwing" }],
        },
      },
      {
        issueId: 3,
        detail: {
          character_credits: [{ id: 1, name: "Nightwing" }],
        },
      },
    ];

    const index = buildCharacterIndex(details, new Set([1, 2, 3]));
    expect(index.size).toBe(1);
  });
});

// ─── enrichCharacterIndex ────────────────────────────────────────────────

describe("enrichCharacterIndex", () => {
  it("layers aliases, real name, deck, image and detailCached onto the entry", () => {
    let index = buildCharacterIndex(
      [
        {
          issueId: 10,
          detail: { character_credits: [{ id: 1, name: "Batman" }] },
        },
      ],
      new Set([10]),
    );
    enrichCharacterIndex(index, [
      {
        characterId: 1,
        detail: {
          aliases: "Bruce Wayne\nBatman",
          real_name: "Bruce Wayne",
          deck: "The Dark Knight",
          image: { super_url: "https://example.com/batman.jpg" },
        },
      },
    ]);

    expect(index.get(1)?.aliases).toEqual(["Bruce Wayne", "Batman"]);
    expect(index.get(1)?.deck).toEqual("The Dark Knight");
    expect(index.get(1)?.image).toEqual("https://example.com/batman.jpg");
    expect(index.get(1)?.detailCached).toBe(true);
  });

  it("ignores cached detail for a character not in the index", () => {
    const index = buildCharacterIndex([], new Set());
    enrichCharacterIndex(index, [
      { characterId: 1, detail: { name: "Bruce" } },
    ]);
    expect(index.size).toEqual(0);
  });

  it("treats an img_broken cover as no image", () => {
    const details = [
      {
        issueId: 10,
        detail: {
          character_credits: [
            {
              id: 1,
              name: "Name",
            },
          ],
        },
      },
    ];
    const index = buildCharacterIndex(details, new Set([10]));

    enrichCharacterIndex(index, [
      {
        characterId: 1,
        detail: { image: { super_url: "https://example.com/img_broken.png" } },
      },
    ]);
    expect(index.get(1)?.image).toBe("");
  });
});

// ─── matchCharacters ─────────────────────────────────────────────────────

describe("matchCharacters", () => {
  it("matches by name, case-insensitively", () => {
    const context = makeContext({
      index: new Map([[1, makeEntry(1, "Nightwing", [10, 11])]]),
    });
    expect(matchCharacters(context, "night")[0]?.name).toBe("Nightwing");
  });

  it("matches by real name", () => {
    const context = makeContext({
      index: new Map([
        [
          1,
          makeEntry(1, "Batman", [10], {
            realName: "Bruce Wayne",
            aliases: ["The Dark Knight"],
          }),
        ],
      ]),
    });
    expect(matchCharacters(context, "wayne")[0]?.name).toBe("Batman");
  });

  it("matches by alias", () => {
    const context = makeContext({
      index: new Map([
        [
          1,
          makeEntry(1, "Batman", [10], {
            realName: "Bruce Wayne",
            aliases: ["The Dark Knight"],
          }),
        ],
      ]),
    });
    expect(matchCharacters(context, "dark")[0]?.name).toBe("Batman");
  });

  it("returns all characters for an empty query, sorted by issue count then name", () => {
    const context = makeContext({
      index: new Map([
        [1, makeEntry(1, "Alpha", [1, 2, 3])],
        [2, makeEntry(2, "Zeta", [1, 2, 3])],
        [3, makeEntry(3, "Beta", [1])],
      ]),
    });
    expect(matchCharacters(context, "").map((m) => m.name)).toEqual([
      "Alpha",
      "Zeta",
      "Beta",
    ]);
    expect(matchCharacters(context, "").map((m) => m.issueCount)).toEqual([
      3, 3, 1,
    ]);
  });

  it("respects the result limit", () => {
    const context = makeContext({
      index: new Map([
        [1, makeEntry(1, "Alpha", [1, 2, 3])],
        [2, makeEntry(2, "Zeta", [1, 2, 3])],
        [3, makeEntry(3, "Beta", [1])],
      ]),
    });
    expect(matchCharacters(context, "", 2).length).toBe(2);
  });

  it("returns readCounts for a character", () => {
      const lib = emptyLibrary();
    lib.issues[10] = { readAt: "2026-01-05" };

  const ctx = makeContext({
    index: new Map([[1, makeEntry(1, "Nightwing", [10, 11])]]),
    lib,
  });

  const [match] = matchCharacters(ctx, "");

  expect(match.readCount).toBe(1);
  expect(match.issueCount).toBe(2);
  })
});

// ─── groupCharacterIssues ────────────────────────────────────────────────

describe("groupCharacterIssues", () => {
  it("groups one character's issues by volume", () => {
    const ctx = makeContext({
      index: new Map([[1, makeEntry(1, "Nightwing", [10, 11])]]),
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Nightwing")]]),
    });
    const result = groupCharacterIssues(ctx, new Set([1]));

    expect(result.characters.map((c) => c.id)).toEqual([1]);
    expect(result.volumes).toHaveLength(1);
    expect(result.volumes[0].issues.map((i) => i.id)).toEqual([10, 11]);
  });

  it("intersects two character slots instead of unioning them", () => {
    const ctx = makeContext({
      index: new Map([
        [1, makeEntry(1, "Nightwing", [10, 11])],
        [2, makeEntry(2, "Red Hood", [11, 12])],
      ]),
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
        [12, makeSummary(12, 1, 3)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Nightwing")]]),
    });

    const result = groupCharacterIssues(ctx, new Set([1]), new Set([2]));
    expect(result.volumes[0].issues).toHaveLength(1);
    expect(result.volumes[0].issues.map((i) => i.id)).toEqual([11]);
  });

  it("unions alias ids within a single slot", () => {
    const ctx = makeContext({
      index: new Map([
        [1, makeEntry(1, "Robin", [10])],
        [2, makeEntry(2, "Robin", [11])],
      ]),
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Robin")]]),
    });
    const result = groupCharacterIssues(ctx, new Set([1, 2]));
    expect(result.volumes[0].issues.map((i) => i.id)).toEqual([10, 11]);
    expect(result.characters.map((c) => c.id)).toEqual([1, 2]);
  });

  it("includes unread issues and sets readAt to null", () => {
    // TODO: lib with issue 10 read ("2026-01-05") and 11 unread.
    // Expect the 10 row's readAt to be the date and 11's to be null.
    const lib = emptyLibrary();
    lib.issues[10] = { readAt: "2026-01-05" };
    const ctx = makeContext({
      index: new Map([[1, makeEntry(1, "Nightwing", [10, 11])]]),
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Nightwing")]]),
      lib,
    });

    const result = groupCharacterIssues(ctx, new Set([1]));
    const byId = new Map(result.volumes[0].issues.map((i) => [i.id, i]));

    expect(byId.get(10)?.readAt).toBe("2026-01-05");
    expect(byId.get(11)?.readAt).toBeNull();
  });

  it("sorts issues by number and volumes by name", () => {
    // TODO: issues pushed out of order; two volumes "Zeta" and "Alpha".
    // Expect issue numbers ascending within a group and Alpha before Zeta.
    const ctx = makeContext({
      index: new Map([[1, makeEntry(1, "Nightwing", [10, 11, 12, 13])]]),
      summariesById: new Map([
        [10, makeSummary(10, 2, 2)],
        [11, makeSummary(11, 2, 1)],
        [12, makeSummary(12, 1, 2)],
        [13, makeSummary(13, 1, 1)],
      ]),
      volumesById: new Map([
        [1, makeVolume(1, "Zeta")],
        [2, makeVolume(2, "Alpha")],
      ]),
    });
    const results = groupCharacterIssues(ctx, new Set([1]));
    expect(results.volumes.map((v) => v.name)).toEqual(["Alpha", "Zeta"]);
    expect(results.volumes.map((v) => v.issues.map((i) => i.id))).toEqual([
      [11, 10],
      [13, 12],
    ]);
  });

  it("ignores unknown character ids", () => {
    // TODO: groupCharacterIssues(ctx, new Set([99])) on a context without 99.
    // Expect volumes [] and characters [].
    const ctx = makeContext({
      index: new Map([[1, makeEntry(1, "Nightwing", [10, 11])]]),
      summariesById: new Map([
        [10, makeSummary(10, 1, 1)],
        [11, makeSummary(11, 1, 2)],
      ]),
      volumesById: new Map([[1, makeVolume(1, "Nightwing")]]),
    });

    expect(groupCharacterIssues(ctx, new Set([99]))).toEqual({
      characters: [],
      volumes: [],
    });
  });
});

// ─── readIssuesOf ─────────────────────────────────────────────────────


describe("readIssuesOf", () => {
  it("if one of two issues read, return one", () => {
    const entry = makeEntry(1, "Batman",[10,11])
    const lib = emptyLibrary();
    lib.issues[10] = { readAt: "2026-01-05" };
    expect(readIssuesOf(entry,lib)).toBe(1);
  })
  it("None read returns 0", () => {
    const entry = makeEntry(1, "Batman",[10,11])
    const lib = emptyLibrary();
    expect(readIssuesOf(entry,lib)).toBe(0);
  })
    it("A read mark for an issue not in entry doesn't count", () => {
    const entry = makeEntry(1, "Batman",[10,11])
    const lib = emptyLibrary();
    lib.issues[15] = { readAt: "2026-01-05" };
    expect(readIssuesOf(entry,lib)).toBe(0);
  })
    it("Character has no issues equals 0", () => {
    const entry = makeEntry(1, "Batman",[])
    const lib = emptyLibrary();
    lib.issues[15] = { readAt: "2026-01-05" };
    expect(readIssuesOf(entry,lib)).toBe(0);
  })
})