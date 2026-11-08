// Creator index, grouping, matching 
// For showing list of writers/artists and listing issues they've worked on

import {
  listCachedIssueDetails,
  listCachedSummaries,
  listCachedVolumes,
  type IssueSummary,
} from "./comicvine.ts";
import { isArtistRole, rolesOf } from "./credits.ts";
import type { Volume } from "./model.ts";
import { readLibrary, type Library } from "./library.ts";

export type Coverage = { indexedRead: number; readTotal: number };

export type CreatorMatch = {
  id: number;
  name: string;
  roles: string[];
  issueCount: number;
  readCount: number;
  favourite: boolean;
};

export type RoleGroup = "writer" | "artist" | "cover";

export type SearchIssue = {
  id: number;
  issueNumber: number;
  name: string;
  datePublished: string;
  readAt: string | null;
  roles: string[];
  roleGroups: RoleGroup[];
};

export type SearchVolumeGroup = {
  volumeId: number;
  name: string;
  startYear: number;
  coverImage: string;
  issues: SearchIssue[];
};

export type CreatorSearchResponse = {
  creator: { id: number; name: string; roles: string[] };
  coverage: Coverage;
  volumes: SearchVolumeGroup[];
};

export type CreatorMatchesResponse = {
  matches: CreatorMatch[];
  coverage: Coverage;
};

export type IssueFilter = {
  readOnly: boolean;
  role: "all" | "writer" | "artist" | "cover";
};

export type CreatorEntry = {
  id: number;
  name: string;
  roles: Set<string>;
  issues: Map<number, Set<string>>;
};

export type CreatorIndex = Map<number, CreatorEntry>;

export type SearchContext = {
  index: CreatorIndex;
  summariesById: Map<number, IssueSummary>;
  volumesById: Map<number, Volume>;
  lib: Library;
  readIds: Set<number>;
  coverage: Coverage;
};

// Pure: raw details in, index out. No filesystem.
export const buildCreatorIndex = (
  details: { id: number; detail: any }[],
  validIssueIds: Set<number>,
): CreatorIndex => {
  const index: CreatorIndex = new Map();

  for (const { id, detail } of details) {
    if (!validIssueIds.has(id)) continue;

    for (const person of detail.person_credits ?? []) {
      if (!person?.id || !person?.name) continue;

      const entry = index.get(person.id) ?? {
        id: person.id,
        name: person.name,
        roles: new Set<string>(),
        issues: new Map<number, Set<string>>(),
      };

      const roles = rolesOf(person);
      for (const role of roles) entry.roles.add(role);

      const issueRoles = entry.issues.get(id) ?? new Set<string>();
      for (const role of roles) issueRoles.add(role);
      entry.issues.set(id, issueRoles);

      index.set(person.id, entry);
    }
  }

  return index;
};

// The only I/O: reads the cache once per request.
export const getSearchContext = async (): Promise<SearchContext> => {
  const [details, summaries, volumes] = await Promise.all([
    listCachedIssueDetails(),
    listCachedSummaries(),
    listCachedVolumes(),
  ]);
  const lib = readLibrary();

  const summariesById = new Map(summaries.map((s) => [s.id, s]));
  const volumesById = new Map(volumes.map((v) => [v.id, v]));
  const readIds = new Set(Object.keys(lib.issues).map(Number));
  const index = buildCreatorIndex(details, new Set(summariesById.keys()));

  const indexedIssueIds = new Set(
    details.filter((d) => summariesById.has(d.id)).map((d) => d.id),
  );

  const coverage: Coverage = {
    indexedRead: [...readIds].filter((id) => indexedIssueIds.has(id)).length,
    readTotal: readIds.size,
  };

  return { index, summariesById, volumesById, lib, readIds, coverage };
};

// Pure: does this issue's role set match the filter?
const matchesRole = (roles: Set<string>, role: IssueFilter["role"]) => {
  if (role === "all") return true;
  if (role === "writer") return roles.has("writer");
  if (role === "cover") return roles.has("cover");
  return [...roles].some(isArtistRole);
};

// Pure: query the index, count the issues that pass the role filter.
export const matchCreators = (
  ctx: SearchContext,
  query: string,
  role: IssueFilter["role"] = "all",
  favouriteOnly = false
): CreatorMatch[] => {
  const q = query.trim().toLowerCase();
  const matches: CreatorMatch[] = [];
  const favCreators = new Set(ctx.lib.favourites.creators);
  for (const entry of ctx.index.values()) {
    if (q && !entry.name.toLowerCase().includes(q)) continue;
    const favourite = favCreators.has(entry.id);
    const issueIds = [...entry.issues]
      .filter(([, roles]) => matchesRole(roles, role))
      .map(([issueId]) => issueId);

    if (issueIds.length === 0) continue;
    if (favouriteOnly && !favourite) continue;

    matches.push({
      id: entry.id,
      name: entry.name,
      roles: [...entry.roles].sort(),
      issueCount: issueIds.length,
      readCount: issueIds.filter((id) => ctx.readIds.has(id)).length,
      favourite,
    });
  }

  return matches
    .sort((a, b) => b.readCount - a.readCount || a.name.localeCompare(b.name))
    .slice(0, 30);
};

// Pure: filter a creator's issues and group them by volume.
export const groupCreatorIssues = (
  ctx: SearchContext,
  creatorId: number,
  filter: IssueFilter,
): CreatorSearchResponse | null => {
  const entry = ctx.index.get(creatorId);
  if (!entry) return null;

  const groups = new Map<number, SearchVolumeGroup>();

  for (const [issueId, roles] of entry.issues) {
    if (filter.readOnly && !ctx.lib.issues[issueId]) continue;
    if (filter.role === "writer" && !roles.has("writer")) continue;
    if (filter.role === "artist" && ![...roles].some(isArtistRole)) continue;
    if (filter.role === "cover" && !roles.has("cover")) continue;

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

    const issueRoles = [...roles].sort();
    const roleGroups: RoleGroup[] = [];
    if (roles.has("writer")) roleGroups.push("writer");
    if (issueRoles.some(isArtistRole)) roleGroups.push("artist");
    if (roles.has("cover")) roleGroups.push("cover");

    group.issues.push({
      id: summary.id,
      issueNumber: summary.issueNumber,
      name: summary.name,
      datePublished: summary.datePublished,
      readAt: ctx.lib.issues[issueId]?.readAt ?? null,
      roles: issueRoles,
      roleGroups,
    });

    groups.set(volume.id, group);
  }

  return {
    creator: { id: entry.id, name: entry.name, roles: [...entry.roles].sort() },
    coverage: ctx.coverage,
    volumes: [...groups.values()]
      .map((group) => ({
        ...group,
        issues: group.issues.sort((a, b) => a.issueNumber - b.issueNumber),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
};

export const searchCreators = async (
  query: string,
  role: IssueFilter["role"] = "all",
    favouriteOnly = false
): Promise<CreatorMatchesResponse> => {
  const ctx = await getSearchContext();
  return { matches: matchCreators(ctx, query, role, favouriteOnly), coverage: ctx.coverage };
};

export const searchCreatorIssues = async (
  creatorId: number,
  filter: IssueFilter,
): Promise<CreatorSearchResponse | null> => {
  const ctx = await getSearchContext();
  return groupCreatorIssues(ctx, creatorId, filter);
};
