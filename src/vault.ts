import type { Issue, PersonCredit, Volume } from "./model.ts";
import { getVolume, loadIssues, type IssueSummary } from "./comicvine.ts";
import { isOngoingVol, readLibrary, volumeTagsOf } from "./library.ts";

export type VolumeYamlInput = {
  title: string;
  startYear: number;
  endYear: number | null;
  type: "ongoing" | "completed";
  writers: string[];
  totalChapter: number;
  cover: string;
  description: string;
  tags: string[];
};

export type VolumeYamlResult = {
  yaml: string;
  writersFrom: number;
  totalIssues: number;
};

export const collectVolumeWriters = (issues: Issue[]): string[] => {
  const creditRoles = (person: PersonCredit) => person.roles ?? [];
  const writerOnly = issues.flatMap((i) =>
    i.credits.filter((p) => creditRoles(p).includes("writer")),
  );
  return [...new Set(writerOnly.map((person) => person.name))];
};

export const volumeYearRange = (
  volume: Volume,
  summaries: IssueSummary[],
): { startYear: number; endYear: number | null } => {
  const sortedSumm = [...summaries].sort(
    (a, b) => a.issueNumber - b.issueNumber || a.name.localeCompare(b.name),
  );
  const startYear =
    Number(sortedSumm[0]?.datePublished?.slice(0, 4)) || volume.startYear;
  const endYear = Number(sortedSumm.at(-1)?.datePublished?.slice(0, 4)) || null;

  return { startYear, endYear };
};

export const buildVolumeYaml = (input: VolumeYamlInput): string => {
const lines = [
  "---",
  `title: ${JSON.stringify(input.title)}`,
  `start_year: ${input.startYear}`,
  `end_year: ${input.endYear ?? ""}`,
  `publisher: ${JSON.stringify("DC Comics")}`,
  `type: ${input.type}`,
  "writer:",
  ...input.writers.map((w) => `  - ${JSON.stringify(w)}`),
  `total_chapter: ${input.totalChapter}`,
  `cover: ${JSON.stringify(input.cover)}`,
  `description: ${JSON.stringify(input.description)}`,
  "tags:",
  ...input.tags.map((tag) => `  - ${JSON.stringify(tag)}`),
  "---",
];

return lines.join("\n");
};

export const getVolumeYaml = async (
  volumeId: number,
): Promise<VolumeYamlResult> => {
  const { volume, summaries } = await getVolume(volumeId);
  const cachedIssues = await loadIssues(summaries);
  const lib = readLibrary();
  const volumeType = isOngoingVol(lib, volume.id) ? "ongoing" : "completed";
  let { startYear, endYear } = volumeYearRange(volume, summaries);
  if (volumeType === "ongoing") endYear = null;
  const writers = collectVolumeWriters(cachedIssues);
  const yaml = buildVolumeYaml({
    title: volume.name,
    startYear,
    endYear,
    type: volumeType,
    writers,
    totalChapter: volume.numberOfIssues,
    cover:
      volume.coverImage ||
      summaries.find((s) => s.coverImage)?.coverImage ||
      "",
    description: volume.description,
    tags: volumeTagsOf(lib, volume.id),
  });

  return {
    yaml,
    writersFrom: cachedIssues.length,
    totalIssues: summaries.length,
  };
};
