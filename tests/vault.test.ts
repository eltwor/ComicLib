import { describe, expect, it } from "vitest";
import type { Issue, Volume } from "../src/model.ts";
import type { IssueSummary } from "../src/comicvine.ts";
import {
  buildVolumeYaml,
  collectVolumeWriters,
  volumeYearRange,
} from "../src/vault.ts";

const makeIssue = (
  id: number,
  issueNumber: number,
  credits: Issue["credits"],
): Issue => ({
  id,
  volumeId: 1,
  issueNumber,
  datePublished: "2000-01-01",
  credits,
  tags: [],
  characters: [],
  coverImage: "",
  name: `Issue ${issueNumber}`,
});

const makeVolume = (startYear = 1997): Volume => ({
  id: 1,
  name: "JLA",
  aliases: [],
  characters: [],
  numberOfIssues: 133,
  startYear,
  coverImage: "",
  description: "",
});

const makeSummary = (
  id: number,
  issueNumber: number,
  datePublished: string,
): IssueSummary => ({
  id,
  volumeId: 1,
  issueNumber,
  datePublished,
  coverImage: "",
  name: `Issue ${issueNumber}`,
});

describe("collectVolumeWriters", () => {
  it("keeps only writers and deduplicates repeated names", () => {
    const issues = [
      makeIssue(1, 1, [
        { id: 10, name: "Grant Morrison", roles: ["writer"] },
        { id: 20, name: "Howard Porter", roles: ["penciller"] },
      ]),
      makeIssue(2, 2, [
        { id: 10, name: "Grant Morrison", roles: ["writer"] },
        { id: 30, name: "Mark Waid", roles: ["writer", "editor"] },
      ]),
    ];

    expect(collectVolumeWriters(issues)).toEqual([
      "Grant Morrison",
      "Mark Waid",
    ]);
  });

  it("returns an empty list when there are no writer credits", () => {
    const issues = [
      makeIssue(1, 1, [
        { id: 20, name: "Howard Porter", roles: ["penciller"] },
      ]),
    ];

    expect(collectVolumeWriters(issues)).toEqual([]);
  });
});

describe("volumeYearRange", () => {
  it("uses the first and last issue by issue number, not array order", () => {
    const summaries = [
      makeSummary(133, 133, "2006-12-01"),
      makeSummary(1, 1, "1997-01-01"),
      makeSummary(60, 60, "2001-06-01"),
    ];

    expect(volumeYearRange(makeVolume(), summaries)).toEqual({
      startYear: 1997,
      endYear: 2006,
    });
  });

  it("falls back to the volume start year when the first issue has no date", () => {
    const summaries = [
      makeSummary(1, 1, ""),
      makeSummary(2, 2, "2000-05-01"),
    ];

    expect(volumeYearRange(makeVolume(1997), summaries)).toEqual({
      startYear: 1997,
      endYear: 2000,
    });
  });

  it("returns a null end year when there are no summaries", () => {
    expect(volumeYearRange(makeVolume(1997), [])).toEqual({
      startYear: 1997,
      endYear: null,
    });
  });
});

describe("buildVolumeYaml", () => {
  const input = {
    title: 'JLA: "Year One"',
    startYear: 1997,
    endYear: null,
    type: "completed" as const,
    writers: ["Grant Morrison", "Mark Waid"],
    totalChapter: 133,
    cover: "https://example.com/jla.jpg",
    description: "A story: with a colon\nand a second line",
    tags: ["Rebirth"],
  };

  it("writes top-level keys at column zero and writer items as a list", () => {
    const yaml = buildVolumeYaml(input);
    const lines = yaml.split("\n");

    expect(yaml.startsWith("---\n")).toBe(true);
    expect(yaml.endsWith("\n---")).toBe(true);
    expect(yaml).toContain(`title: ${JSON.stringify(input.title)}\n`);
    expect(yaml).toContain("start_year: 1997");
    expect(yaml).toContain("end_year: \n");
    expect(yaml).toContain(
      `writer:\n  - ${JSON.stringify("Grant Morrison")}\n  - ${JSON.stringify("Mark Waid")}`,
    );
    expect(yaml).toContain(`description: ${JSON.stringify(input.description)}`);
    expect(yaml).toContain('tags:\n  - "Rebirth"');

    const indentedNonWriterLines = lines.filter(
      (line) => line.startsWith(" ") && !line.startsWith("  - "),
    );
    expect(indentedNonWriterLines).toEqual([]);
  });

  it("quotes scalars so YAML-sensitive characters do not break the note", () => {
    const yaml = buildVolumeYaml(input);

    expect(yaml).toContain('title: "JLA: \\"Year One\\""');
    expect(yaml).toContain(
      'description: "A story: with a colon\\nand a second line"',
    );
  });

  it("leaves writer blank when there are no writers", () => {
    const yaml = buildVolumeYaml({ ...input, writers: [] });
    expect(yaml).toContain("writer:\n");
  });
});
