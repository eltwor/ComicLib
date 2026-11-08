import type { CharacterRef, Issue, Volume } from "../src/model.ts";

// Test fixture only — arbitrary ids, consistent per character name.
const CHARACTER_IDS: Record<string, number> = {
  "Red Hood": 1,
  Bane: 2,
  "Arkham Knight": 3,
  "Man-Bat": 4,
  "Mister Bloom": 5,
  "Mister Freeze": 6,
  "Dr. Shelley": 7,
  Artemis: 8,
  Bizarro: 9,
  Batman: 10,
  "Black Mask": 11,
  "Solomon Grundy": 12,
  "Harvey Dent": 13,
  Batgirl: 14,
  Nightwing: 15,
  Oracle: 16,
  "Red Robin": 17,
  Beast: 18,
};

const characters = (...names: string[]): CharacterRef[] =>
  names.map((name) => ({ id: CHARACTER_IDS[name] ?? 0, name }));

export const seedIssues: Issue[] = [
  {
    id: 1,
    volumeId: 1,
    issueNumber: 1,
    datePublished: "2021-10-26",
    credits: [
      { id: 1, name: "Matthew Rosenberg", roles: ["writer"] },
      { id: 2, name: "Eddy Barrows", roles: ["artist"] },
    ],
    tags: ["Infinite Frontier"],
    characters: characters(
      "Red Hood",
      "Bane",
      "Arkham Knight",
      "Man-Bat",
      "Mister Bloom",
      "Mister Freeze",
      "Dr. Shelley",
    ),
    coverImage: "linkHere",
    name: "",
  },
  {
    id: 2,
    volumeId: 2,
    issueNumber: 6,
    datePublished: "2017-01-11",
    credits: [
      { id: 3, name: "Scott Lobdell", roles: ["writer"] },
      { id: 4, name: "Dexter Soy", roles: ["penciler"] },
      { id: 5, name: "Veronica Gandini", roles: ["inker"] },
    ],
    tags: ["Rebirth"],
    characters: characters(
      "Red Hood",
      "Artemis",
      "Bizarro",
      "Batman",
      "Black Mask",
    ),
    coverImage: "linkHere",
    name: "",
  },
  {
    id: 3,
    volumeId: 1,
    issueNumber: 8,
    datePublished: "2022-10-24",
    credits: [
      { id: 1, name: "Matthew Rosenberg", roles: ["writer"] },
      { id: 6, name: "Jesus Merino", roles: ["penciler"] },
      { id: 7, name: "Jack Herbert", roles: ["inker"] },
      { id: 8, name: "Vicente Cifuentes", roles: ["colorist"] },
    ],
    tags: ["Infinite Frontier"],
    characters: characters(
      "Red Hood",
      "Solomon Grundy",
      "Harvey Dent",
      "Batgirl",
      "Nightwing",
      "Batman",
      "Oracle",
      "Red Robin",
    ),
    coverImage: "linkHere",
    name: "",
  },
  {
    id: 4,
    volumeId: 2,
    issueNumber: 10,
    datePublished: "2017-08-30",
    credits: [
      { id: 3, name: "Scott Lobdell", roles: ["writer"] },
      { id: 9, name: "Tyler Kirkham", roles: ["cover"] },
      { id: 10, name: "Arif Prianto", roles: ["artist"] },
    ],
    tags: ["Rebirth"],
    characters: characters("Red Hood", "Artemis", "Bizarro", "Nightwing", "Beast"),
    coverImage: "linkHere",
    name: "",
  },
];

export function findIssues(
  issues: Issue[],
  characters: string[],
  tag?: string,
): Issue[] {
  return issues.filter(
    (issue) =>
      characters.every((name) =>
        issue.characters.some((character) => character.name === name),
      ) && (!tag || issue.tags.includes(tag)),
  );
}

export function publishedYear(datePublished: string): number {
  return Number(datePublished.slice(0, 4));
}

export function makeLabel(volume: Volume, issue: Issue): string {
  return `${volume.name} #${issue.issueNumber}`;
}
  