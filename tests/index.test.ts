import { describe, expect, it } from "vitest";
import { findIssues, makeLabel, publishedYear, seedIssues } from "./fixtures.ts";
import type { Volume, Issue } from "../src/model.ts";

const ids = (issues: { id: number }[]) => issues.map((issue) => issue.id);

describe("findIssues", () => {
  it("returns only issues from the requested era", () => {
    const results = findIssues(seedIssues, ["Nightwing", "Red Hood"], "Rebirth");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((issue) => issue.tags.includes("Rebirth"))).toBe(true);
    expect(ids(results)).toContain(4);
  });

  it("correct date format", () => {
    for (const issue of findIssues(seedIssues,[])) {
      expect(issue.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("ignores era when none is given", () => {
    const results = findIssues(seedIssues,["Nightwing", "Red Hood"]);
    const tags = new Set(results.flatMap((issue) => issue.tags));
    expect(tags.size).toBeGreaterThan(1);
    expect(ids(results)).toEqual(
      expect.arrayContaining([3,4])
    );
  });

  it("returns nothing for an era with no matches", () => {
    expect(findIssues(seedIssues,["Nightwing", "Red Hood"], "New 52")).toEqual([]);
  });

  it("returns every issue containing a single character", () => {
    const results = findIssues(seedIssues,["Red Hood"]);
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((issue) => issue.characters.some((c) => c.name === "Red Hood"))
    ).toBe(true);
  });

  it("returns nothing for an unknown character", () => {
    expect(findIssues(seedIssues,["Nobody"])).toEqual([]);
  });

  it("requires all characters, not just one", () => {
    // Bizarro and Oracle each appear in the seed, but never in the same issue.
    expect(findIssues(seedIssues,["Bizarro", "Oracle"])).toEqual([]);
  });

  it("treats an empty character list as matching everything", () => {
    expect(ids(findIssues(seedIssues,[]))).toEqual(
      expect.arrayContaining([1,2,3,4])
    );
  });

  it("matches names exactly, so case matters", () => {
    expect(findIssues(seedIssues,["red hood"])).toEqual([]);
  });
});

describe("publishedYear", () => {
  it("Does date of \"2021-10-26\" returns 2021 number", () => {
   expect(publishedYear("2021-10-26")).toBe(2021);
  });
    it("Does date of \"2017-10-26\" returns 2017 number", () => {
   expect(publishedYear("2017-10-26")).toBe(2017);
  });
});

export function makeVolume(getName: string): Volume {
  let newVolume = {
    id: 10,
    name: getName,
    aliases: [''],
    characters: [],
    numberOfIssues: 10,
    startYear: 2016,
    coverImage: "", 
    description: "",
  }
  return newVolume;
}

export function makeIssue(getNumber: number): Issue {
  let newIssue = {
    id: 10,
    volumeId: 10,
    issueNumber: getNumber,
    datePublished: "",
   credits: [],
    tags: ["Rebirth"],
    characters: [{id: 0, name: ""}],
    coverImage: "linkHere",
        name: ""

  }
  return newIssue;
}

describe("makeLabel", () => {
  it("RHATO Label", () => {
    const testVolume = makeVolume("Red Hood and the Outlaws");
    const testIssue = makeIssue(4)
    const results = makeLabel(testVolume,testIssue)
   expect(results).toBe("Red Hood and the Outlaws #4");
  });

  it("Annual check", () => {
    const testVolume = makeVolume("Task Force Z annual");
    const testIssue = makeIssue(1,)
    const results = makeLabel(testVolume,testIssue)
   expect(results).toBe("Task Force Z annual #1");
  });
});