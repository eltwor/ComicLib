import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const LIBRARY_FILE = process.env.LIBRARY_FILE ?? "library.json";

export type IssueEntry = { readAt: string }; // readAt is editable
export type VolumeEntry = {
  ongoing?: true;
  ignored?: true;
  reading?: true;
  nextRelease?: string;
  tags?: string[];
};
export type VolumeState = "untouched" | "to-read" | "reading" | "caught-up" | "partial" | "complete";
export type Library = {
  volumes: Record<string, VolumeEntry>;
  issues: Record<string, IssueEntry>;
  favourites: Favourites;
  editions: Record<number, Edition>
};
type Favourites = {volumes: number[], creators: number[]}

export type VolumeDates = {
  firstReadAt: string | null;
  lastReadAt: string | null;
};

export type EditionFormat =
  | "single" | "trade" | "hc" | "compact" | "omnibus" | "compendium";

export type Edition = {
  id: number;
  name: string;
  format: EditionFormat;
  issues: number[];
  owned: boolean;
  coverId?: number;
};

// ─── pure core: takes the object, touches nothing ───
export const emptyLibrary = (): Library => ({ volumes: {}, issues: {}, favourites: {volumes: [], creators: []}, editions: {}});
export const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ─── Favourites ───

export const isFavouriteVolume = (lib: Library, volumeId: number) : boolean => lib.favourites.volumes.includes(volumeId);
export const isFavouriteCreator = (lib: Library, creatorId: number) : boolean => lib.favourites.creators.includes(creatorId);

// Finds if id exists in the array - if it does delete it, if it doesn't add it - Favouriting and unfavoriting for both volumeIds and creatorIds
const toggleId = (ids: number[], id: number) : boolean => {
  const index = ids.indexOf(id);
  if(index >= 0) {
    ids.splice(index,1);
    return false;
  }
    ids.push(id);
    return true
  
}

export const toggleFavouriteVolume = (lib: Library, volumeId: number) => toggleId(lib.favourites.volumes,volumeId)
export const toggleFavouriteCreator = (lib: Library, creatorId: number) => toggleId(lib.favourites.creators,creatorId)

// Reads status of issues and volumes
export const readAtOfIss = (lib: Library, issueId: number) => lib.issues[issueId]?.readAt;
export const isIgnoredVol = (lib: Library, volumeId: number) => lib.volumes[volumeId]?.ignored === true;
export const isReadingVol = (lib: Library, volumeId: number) => lib.volumes[volumeId]?.reading === true;
export const volumeState = (read: number, total: number, reading: boolean, ongoing: boolean): VolumeState => {
  if (total > 0 && read >= total) return ongoing ? "caught-up" : "complete"; // extent, not pulled count
  if (reading) return read === 0 ? "to-read" : "reading";
  return read > 0 ? "partial" : "untouched";
};

export const isOngoingVol = (lib: Library, volumeId: number) => lib.volumes[volumeId]?.ongoing === true;

// Unreading aand deleting volumes
export const clearReadIss = (lib: Library, issueId: number) => { delete lib.issues[issueId]; };

const pruneVolume = (lib: Library, id: number) => {
  const v = lib.volumes[id];
  if (
    v &&
    !v.ignored &&
    !v.reading &&
    !v.ongoing &&
    !v.nextRelease &&
    !v.tags?.length
  ) {
    delete lib.volumes[id];
  }
};

export const clearBulkRead = (lib: Library, issueIds: number[]) => {
  for (const id of issueIds) delete lib.issues[id];
};

// Changing statuses

export const applyReadIss = (lib: Library, issueId: number, readAt: string) => {
  lib.issues[issueId] = { readAt };
};

export const applyIgnoredVol = (lib: Library, id: number, ignored: boolean) => {
  if (ignored) lib.volumes[id] = { ...lib.volumes[id], ignored: true };
  else { if (lib.volumes[id]) delete lib.volumes[id].ignored; pruneVolume(lib, id); }
};

export const applyReadingVol = (lib: Library, id: number, reading: boolean) => { 
    if (reading) lib.volumes[id] = {...lib.volumes[id], reading: true};
    else { if(lib.volumes[id]) delete lib.volumes[id].reading; pruneVolume(lib,id)}
 }; 

 export const applyOngoingVol =  (lib: Library, id: number, ongoing: boolean) => { 
    if (ongoing) lib.volumes[id] = {...lib.volumes[id], ongoing: true};
    else { if(lib.volumes[id]) delete lib.volumes[id].ongoing; pruneVolume(lib,id)}
 }; 

 export const applyBulkRead = (lib: Library, issueIds: number[], readAt: string) => {
  for (const id of issueIds) lib.issues[id] = { readAt };
};

// Next release: a stored override for hiatuses, otherwise derived from the last issue.
export const nextReleaseOf = (lib: Library, volumeId: number) =>
  lib.volumes[volumeId]?.nextRelease;

export const applyNextReleaseVol = (
  lib: Library,
  id: number,
  date: string | null,
) => {
  if (date) {
    lib.volumes[id] = { ...lib.volumes[id], nextRelease: date };
    return;
  }

  if (lib.volumes[id]) delete lib.volumes[id].nextRelease;
  pruneVolume(lib, id);
};

// Tags: era/continuity labels are stored judgments, one list per volume.
export const volumeTagsOf = (lib: Library, volumeId: number): string[] =>
  lib.volumes[volumeId]?.tags ?? [];

export const applyVolumeTag = (
  lib: Library,
  id: number,
  tag: string,
  add: boolean,
): string[] => {
  const clean = tag.trim();
  if (!clean) return volumeTagsOf(lib, id);

  const current = volumeTagsOf(lib, id);
  const lower = clean.toLowerCase();

  if (add) {
    if (!current.some((entry) => entry.toLowerCase() === lower)) {
      lib.volumes[id] = { ...lib.volumes[id], tags: [...current, clean] };
    }
  } else if (lib.volumes[id]) {
    const next = current.filter((entry) => entry.toLowerCase() !== lower);
    if (next.length) lib.volumes[id].tags = next;
    else delete lib.volumes[id].tags;
    pruneVolume(lib, id);
  }

  return volumeTagsOf(lib, id);
};


 // Filtering

export const withReadIss = <T extends { id: number }>(rows: T[], lib: Library) =>
  rows.map((row) => ({ ...row, readAt: readAtOfIss(lib, row.id) ?? null}));

export const progressByVolume = (lib: Library, summaries: { id: number; volumeId: number }[]) => {
  const byVolume = new Map<number, { pulled: number; read: number }>();
  for (const s of summaries) {
    const p = byVolume.get(s.volumeId) ?? { pulled: 0, read: 0 };
    p.pulled += 1;
    if (lib.issues[s.id] !== undefined) p.read += 1;
    byVolume.set(s.volumeId, p);
  }
  return byVolume;
};

export const readDatesByVolume = (
  lib: Library,
  summaries: { id: number; volumeId: number }[],
) => {
  const byVolume = new Map<number, VolumeDates>();
  for (const s of summaries) {
    const date = lib.issues[s.id]?.readAt;
    if (!date) continue;
    const d = byVolume.get(s.volumeId) ?? { firstReadAt: null, lastReadAt: null };
    if (!d.firstReadAt || date < d.firstReadAt) d.firstReadAt = date;
    if (!d.lastReadAt || date > d.lastReadAt) d.lastReadAt = date;
    byVolume.set(s.volumeId, d);
  }
  return byVolume;
};

export const latestIssueDateByVolume = (
  summaries: { volumeId: number; datePublished: string }[],
) => {
  const byVolume = new Map<number, string>();

  for (const summary of summaries) {
    if (!summary.datePublished) continue;
    const current = byVolume.get(summary.volumeId);
    if (!current || summary.datePublished > current) {
      byVolume.set(summary.volumeId, summary.datePublished);
    }
  }

  return byVolume;
};

export type MonthIssue = { id: number; issueNumber: number;  volumeId: number; readAt: string };
export type MonthGroupKind = "volume" | "edition";
export type MonthGroup = { kind: MonthGroupKind; id: number; issues: MonthIssue[] };
export type MonthReads = Map<string, Map<string, MonthGroup>>;   // month -> "kind:id" -> group

export const readsByMonth = (
  lib: Library,
  summaries: { id: number; volumeId: number; issueNumber: number }[],
  editionOf?: (issueId: number) => Edition | undefined
): MonthReads => {
  const byMonth: MonthReads = new Map();

  for (const s of summaries) {
    const date = lib.issues[s.id]?.readAt;
    if (!date) continue;

    const month = date.slice(0, 7);
    const groups = byMonth.get(month) ?? new Map<string, MonthGroup>();

    const edition = editionOf?.(s.id);
    const target: { kind: MonthGroupKind; id: number } = edition
      ? { kind: "edition", id: edition.id }
      : { kind: "volume", id: s.volumeId };

    const key = `${target.kind}:${target.id}`;
    const issue = {
      id: s.id,
      issueNumber: s.issueNumber,
      volumeId: s.volumeId,
      readAt: date,
    };

    const group = groups.get(key);
    if (group) group.issues.push(issue);
    else groups.set(key, { kind: target.kind, id: target.id, issues: [issue] });

    byMonth.set(month, groups);
  }

  return byMonth;
};
// ────── editions helpers ──────
export const bestEdition = (candidates: Edition[]): Edition | undefined => {
  let best: Edition | undefined;

  for (const edition of candidates) {
    if (!best) {
      best = edition;
      continue;
    }
    if (edition.issues.length !== best.issues.length) {
      if (edition.issues.length < best.issues.length) best = edition;
      continue;
    }
    if (edition.name !== best.name) {
      if (edition.name < best.name) best = edition;
      continue;
    }
    if (edition.id < best.id) best = edition;
  }

  return best;
};


export const editionsByIssue = (lib: Library): Map<number, Edition[]> => {
  const listEditions = new Map<number, Edition[]>;

  for (const edition of Object.values(lib.editions)) {
    for (const issueId of edition.issues) {
      const editions = listEditions.get(issueId) ?? [];
      editions.push(edition);
      listEditions.set(issueId, editions);
    }
  }

  for (const [issueId, editions] of listEditions) {
    listEditions.set(issueId, editions.sort((a, b) => a.id - b.id));
  }
  return listEditions;
};

export const editionForIssue = (lib: Library, issueId: number): Edition | undefined => {
  return bestEdition(editionsByIssue(lib).get(issueId) ?? [])
}
export const editionProgress = (lib: Library, edition: Edition) => {
  const total = edition.issues.length;
  let read = 0;
  for(const i of edition.issues) {
    if(lib.issues[i] !== undefined) read+= 1;
  }
  return {read,total};
}

export const editionCoverId = (edition: Edition): number | undefined => {
  if(edition.coverId && edition.issues.includes(edition.coverId)) return edition.coverId;
  return edition.issues[0];
}
// ────── editions writers ──────

type NewEditionInput = Omit<Edition, 'id'>;

export const createEdition = (lib:Library, {name,format,issues,owned}: NewEditionInput)  : Edition => {
  const existingIds = Object.keys(lib.editions).map(Number);
  const nextId = Math.max(0,...existingIds) + 1;

  const newEdition : Edition = {
    id: nextId,
    name: name.trim(),
    format,
    coverId: undefined,
    issues: [...new Set(issues)],
    owned
  }
    lib.editions[nextId] = newEdition;
  return newEdition;
}

export const updateEdition = (lib:Library, id:number, patch:{name?:string,format?:EditionFormat,owned?:boolean, coverId?: number | null}) : Edition | undefined => {
  const oldEdition = lib.editions[id];
  if (!oldEdition) return undefined;

  const updatedEdition : Edition = {
    ...oldEdition,
    name: patch.name?.trim() || oldEdition.name,
    format: patch.format || oldEdition.format,
    owned: patch.owned ?? oldEdition.owned,
    coverId: patch.coverId === undefined ? oldEdition.coverId : (patch.coverId ?? undefined)
  };
  lib.editions[id] = updatedEdition;
  return updatedEdition;
}

export const applyEditionIssues = (lib:Library,id:number,add:number[],remove:number[]) => {
 const edition = lib.editions[id];
 if (!edition) return;

 return edition.issues = [...new Set([...edition.issues, ...add])]
   .filter(issueId => !remove.includes(issueId));
}

export const deleteEdition = (lib:Library, id:number) => {
  if(!lib.editions[id]) return false;
  return delete lib.editions[id];
}

// ─── thin I/O shell ───
export const readLibrary = (): Library => {
   if (!existsSync(LIBRARY_FILE)) return emptyLibrary();

  const raw = JSON.parse(readFileSync(LIBRARY_FILE, "utf8"));

  return {
    volumes: raw.volumes ?? {},
    issues: raw.issues ?? {},
    favourites: {
      volumes: [...new Set<number>(raw.favourites?.volumes ?? [])],
      creators: [...new Set<number>(raw.favourites?.creators ?? [])],
    },
    editions: raw.editions ?? {}
  };
}

export const writeLibrary = (lib: Library) => {
  mkdirSync(dirname(LIBRARY_FILE), { recursive: true });
  writeFileSync(LIBRARY_FILE, JSON.stringify(lib, null, 2) + "\n");
};

export const updateLibrary = (change: (lib: Library) => void): Library => {
  const lib = readLibrary();
  change(lib);
  writeLibrary(lib);
  return lib;
};


