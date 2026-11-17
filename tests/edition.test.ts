import { describe, expect, it } from "vitest";
import {
  editionForIssue,
  editionProgress,
  editionsByIssue,
  emptyLibrary,
  type Edition,
  type Library,
} from "../src/library.ts";

// ─── harness ─────────────────────────────────────────────────────────────
// Editions are plain records; read marks are the same overlay the rest of the
// app uses. Nothing here touches the filesystem.

const makeEdition = (
  id: number,
  name: string,
  issues: number[],
  overrides: Partial<Edition> = {},
): Edition => ({
  id,
  name,
  format: "trade",
  issues,
  owned: true,
  ...overrides,
});

const libWith = (editions: Edition[], readIssueIds: number[] = []): Library => {
  const lib = emptyLibrary();
  for (const edition of editions) lib.editions[edition.id] = edition;
  for (const id of readIssueIds) lib.issues[id] = { readAt: "2026-01-05" };
  return lib;
};

// ─── editionsByIssue ─────────────────────────────────────────────────────

describe("editionsByIssue", () => {
  it("indexes each issue under the edition that contains it", () => {
    const editions = []
    editions.push(makeEdition(1,"Edition 1",[10,11]));
    editions.push(makeEdition(2,"Edition 2",[12]));
    const result = editionsByIssue(libWith(editions))
    expect(result.get(10)?.map((e) => e.name)).toEqual(["Edition 1"]);
    expect(result.get(12)?.map((e) => e.name)).toEqual(["Edition 2"]);

  });

  it("lists both editions for an issue collected twice", () => {
        const editions = []
    editions.push(makeEdition(1,"Edition 1",[10,11,12]));
    editions.push(makeEdition(2,"Edition 2",[10,20]));
    const result = editionsByIssue(libWith(editions))
    expect(result.get(10)?.map((e) => e.id)).toEqual([1,2]);
  });

  it("returns an empty map when there are no editions", () => {
    expect(editionsByIssue(emptyLibrary())).toEqual(new Map())
  });
});

// ─── editionForIssue ─────────────────────────────────────────────────────

describe("editionForIssue", () => {
  it("returns the only edition containing the issue", () => {
    const edition = [makeEdition(1,"Edition 1",[10,11])];
    const lib = libWith(edition)
    expect(editionForIssue(lib,10)?.id).toEqual(1)
  });

  it("returns the smallest edition when several contain the issue", () => {
    // Expect edition 1 — fewest issues wins.
    const edition = [makeEdition(1,"Edition 1",[10,11,12]),makeEdition(2,"Omni 1",[10,11,12,13,14])]
    const lib = libWith(edition)
    expect(editionForIssue(lib,10)?.id).toEqual(1);
  });

  it("breaks an equal-size tie by name", () => {
    const edition = [makeEdition(1,"Zeta",[10,11]),makeEdition(2,"Alpha",[10,12])]
    const lib = libWith(edition);
    expect(editionForIssue(lib,10)?.name).toEqual("Alpha");
  });

  it("returns undefined when no edition contains the issue", () => {
    const edition = [makeEdition(1,"Compendium",[10,11])]
    const lib = libWith(edition);
    expect(editionForIssue(lib,99)).toBeUndefined();
  });
});

// ─── editionProgress ─────────────────────────────────────────────────────

describe("editionProgress", () => {
  it("counts only the read issues", () => {
    const edition = makeEdition(1,"Compendium",[10,11,12])
    const lib = libWith([edition],[10,12]);
    expect(editionProgress(lib,edition)).toEqual({read: 2, total: 3});
  });

  it("counts uncached issue ids toward the total", () => {
    // Membership is the book's contents; cache coverage is irrelevant.
    const edition = makeEdition(1,"Compendium",[10,999]);
    const lib = libWith([edition],[10]);
    expect(editionProgress(lib,edition)).toEqual({read: 1, total: 2});
  });

  it("returns 0 of 0 for an empty edition", () => {
    const edition = makeEdition(1,"Compendium",[]);
    const lib = libWith([edition]);
    expect(editionProgress(lib,edition)).toEqual({read: 0, total: 0});

  });
});
