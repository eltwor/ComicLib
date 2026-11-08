// ─── character.ts — derived character index + pure queries ───────────────
// The index starts from character_credits in cached issue details: id, name,
// and which issues credit them. Aliases, deck, image and real name are layered
// on from cached character-<id>.json details, so they only cover characters
// whose detail page has been opened.

import {
  listCachedCharacterDetails,
  listCachedIssueDetails,
  listCachedSummaries,
  listCachedVolumes,
  type IssueSummary,
} from "./comicvine.ts";
import type { Volume } from "./model.ts";
import { readLibrary, type Library } from "./library.ts";

export type CharacterEntry = {
  id: number;
  name: string;
  issueIds: Set<number>;
  aliases: string[];
  realName: string;
  image: string;
  deck: string;
  detailCached: boolean;
};

export type CharacterIndex = Map<number, CharacterEntry>;

export type CharacterIssue = {
  id: number;
  issueNumber: number;
  name: string;
  datePublished: string;
  readAt: string | null;
};

export type CharacterVolumeGroup = {
  volumeId: number;
  name: string;
  startYear: number;
  coverImage: string;
  issues: CharacterIssue[];
};

export type CharacterResultRef = {
  id: number;
  name: string;
  realName: string;
  image: string;
};

export type CharacterMatch = CharacterResultRef & {
  aliases: string[];
  deck: string;
  detailCached: boolean;
  issueCount: number;
};

export type CharacterContext = {
  index: CharacterIndex;
  summariesById: Map<number, IssueSummary>;
  volumesById: Map<number, Volume>;
  lib: Library;
};

export type CharacterSearchResponse = {
  characters: CharacterResultRef[];
  volumes: CharacterVolumeGroup[];
};

// ComicVine aliases are newline-separated.
const splitAliases = (raw: unknown): string[] =>
  typeof raw === "string"
    ? raw
        .split(/\r?\n/)
        .map((alias) => alias.trim())
        .filter(Boolean)
    : [];

const imageUrl = (image: any): string => {
  const url = image?.super_url ?? "";
  return /img_broken\.png$/i.test(url) ? "" : url;
};

// Pure: issue credits in, id -> character + issueIds out.
export const buildCharacterIndex = (
  details: { id: number; detail: any }[],
  validIssueIds: Set<number>,
): CharacterIndex => {
  const index: CharacterIndex = new Map();

  for (const { id: issueId, detail } of details) {
    if (!validIssueIds.has(issueId)) continue;

    for (const credit of detail.character_credits ?? []) {
      if (!credit?.id || !credit?.name) continue;

      const entry = index.get(credit.id) ?? {
        id: credit.id,
        name: credit.name,
        issueIds: new Set<number>(),
        aliases: [],
        realName: "",
        image: "",
        deck: "",
        detailCached: false,
      };

      entry.issueIds.add(issueId);
      index.set(credit.id, entry);
    }
  }

  return index;
};

// Pure: layer cached character details onto the index. Cached details without
// issue credits are not in the index; the browse grid reads the cache directly.
export const enrichCharacterIndex = (
  index: CharacterIndex,
  details: { id: number; detail: any }[],
): CharacterIndex => {
  for (const { id, detail } of details) {
    const entry = index.get(id);
    if (!entry) continue;

    entry.aliases = splitAliases(detail.aliases);
    entry.realName = detail.real_name ?? "";
    entry.image = imageUrl(detail.image);
    entry.deck = detail.deck ?? "";
    entry.detailCached = true;
  }

  return index;
};

const matchesCharacter = (entry: CharacterEntry, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return (
    entry.name.toLowerCase().includes(needle) ||
    entry.realName.toLowerCase().includes(needle) ||
    entry.aliases.some((alias) => alias.toLowerCase().includes(needle))
  );
};

// Pure: autocomplete matches. Exact names cover every credited character;
// aliases and real names only cover characters whose detail is cached.
export const matchCharacters = (
  ctx: CharacterContext,
  query: string,
  limit = 20,
): CharacterMatch[] =>
  [...ctx.index.values()]
    .filter((entry) => matchesCharacter(entry, query))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      realName: entry.realName,
      image: entry.image,
      aliases: entry.aliases,
      deck: entry.deck,
      detailCached: entry.detailCached,
      issueCount: entry.issueIds.size,
    }))
    .sort((a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, limit);

const issuesFor = (ctx: CharacterContext, ids: Set<number>) => {
  const out = new Set<number>();
  for (const id of ids) {
    for (const issueId of ctx.index.get(id)?.issueIds ?? []) {
      out.add(issueId);
    }
  }
  return out;
};

// Pure: one or two resolved character-id sets -> pulled issues grouped by
// volume. AND between slots, OR within each slot. Every issue with cached
// details counts, read or not; readAt is display metadata only.
export const groupCharacterIssues = (
  ctx: CharacterContext,
  a: Set<number>,
  b?: Set<number>,
): CharacterSearchResponse => {
  let issueIds = issuesFor(ctx, a);

  if (b) {
    const second = issuesFor(ctx, b);
    issueIds = new Set([...issueIds].filter((id) => second.has(id)));
  }

  const groups = new Map<number, CharacterVolumeGroup>();

  for (const issueId of issueIds) {
    const summary = ctx.summariesById.get(issueId);
    if (!summary) continue;

    const volume = ctx.volumesById.get(summary.volumeId);
    if (!volume) continue;

    const group = groups.get(volume.id) ?? {
      volumeId: volume.id,
      name: volume.name,
      startYear: volume.startYear,
      coverImage: volume.coverImage,
      issues: [],
    };

    group.issues.push({
      id: summary.id,
      issueNumber: summary.issueNumber,
      name: summary.name,
      datePublished: summary.datePublished,
      readAt: ctx.lib.issues[issueId]?.readAt ?? null,
    });

    groups.set(volume.id, group);
  }

  const characters = [...a, ...(b ?? [])]
    .map((id) => ctx.index.get(id))
    .filter((entry): entry is CharacterEntry => Boolean(entry))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      realName: entry.realName,
      image: entry.image,
    }));

  return {
    characters,
    volumes: [...groups.values()]
      .map((group) => ({
        ...group,
        issues: group.issues.sort((x, y) => x.issueNumber - y.issueNumber),
      }))
      .sort((x, y) => x.name.localeCompare(y.name)),
  };
};


// The only I/O: reads the cache once per request.
export const getCharacterContext = async (): Promise<CharacterContext> => {
  const [details, characterDetails, summaries, volumes] = await Promise.all([
    listCachedIssueDetails(),
    listCachedCharacterDetails(),
    listCachedSummaries(),
    listCachedVolumes(),
  ]);
  const lib = readLibrary();

  const summariesById = new Map(summaries.map((s) => [s.id, s]));
  const volumesById = new Map(volumes.map((v) => [v.id, v]));
  const index = enrichCharacterIndex(
    buildCharacterIndex(details, new Set(summariesById.keys())),
    characterDetails,
  );

  return { index, summariesById, volumesById, lib };
};