// ─── model types + pure queries ─────────────────────────────────────────

export type Issue = {
  id: number; // key to link connections
  volumeId: number; // id linking Volume and Issue
  issueNumber: number;
  datePublished: string; // ex. 2022-10-01
  credits: PersonCredit[];
  tags: string[]; // ex. Pre-crisis/New 52/Rebirth etc
  characters: CharacterRef[]; // drawn in the comic, not just mentioned
  coverImage: string; // link to the cover img url
  name: string;
};

export type Volume = {
  id: number;
  name: string; // Volume title (like Batman)
  aliases: string[]; // different names for the volume
  characters: CharacterCountRef[];
  numberOfIssues: number;
  startYear: number;
  coverImage: string;
  description: string;
};

export type PersonCredit = { id: number; name: string; roles: string[] };

export type CharacterRef = { id: number; name: string };

export type CharacterCountRef = CharacterRef & { count: number };


export type Character = {
  id: number;
  name: string;
  realName: string;
  aliases: string[];
  deck: string;
  image: string;
  publisher: string;
  firstAppearedIn: string;
  globalAppearances: number;
  siteUrl: string;
};

