// ─── transforms — pure: raw in, typed out ──────────

import type { IssueSummary } from "./comicvine.ts";
import type { Character, Issue, Volume } from "./model.ts";
import { rolesOf } from "./credits.ts";

// ComicVine descriptions are HTML - strip once
const stripTags = (html: string) => html.replace(/<[^>]*>/g, "");
const firstParagraph = (html: string) => stripTags(html.split("</p>")[0]);

// ComicVine uses img_broken.png when it has no image; treat it as "no cover".
const BROKEN_COVER = /img_broken\.png$/i;
const imageUrl = (image: any): string => {
  const url = image?.super_url ?? "";
  return BROKEN_COVER.test(url) ? "" : url;
};

// Summary from /issues call
export const rawToIssueSummary = (issueRaw: any): IssueSummary => {
  let summIssue = {
    id: issueRaw.id,
    volumeId: issueRaw.volume.id,
    issueNumber: Number(issueRaw.issue_number),
    name: issueRaw.name ?? "",
    datePublished: issueRaw.store_date || issueRaw.cover_date || "",
    coverImage: imageUrl(issueRaw.image),
  };
  return summIssue;
};

// the mirror of rawToIssueSummary: the UI never sees snake_case
export const rawToVolume = (raw: any): Volume => ({
  id: raw.id,
  name: raw.name ?? "",
  aliases: raw.aliases ? raw.aliases.split("/\r?\n/") : [],
  numberOfIssues: Number(raw.count_of_issues) || 0,
  startYear: Number(raw.start_year) || 0,
  coverImage: imageUrl(raw.image),
  description: firstParagraph(raw.description ?? ""),
  characters: (raw.characters ?? [])
    .filter((character: any) => character?.id && character?.name)
    .map((character: any) => ({
      id: character.id,
      name: character.name,
      count: Number(character.count) || 0,
    })),
});

// Character Detail from /character call
export const rawToCharacter = (raw: any): Character => ({
  id: raw.id,
  name: raw.name ?? "",
  realName: raw.real_name ?? "",
  aliases: raw.aliases
    ? raw.aliases
        .split(/\r?\n/)
        .map((alias: string) => alias.trim())
        .filter(Boolean)
    : [],
  deck: raw.deck ?? "",
  image: imageUrl(raw.image),
  publisher: raw.publisher?.name ?? "",
  firstAppearedIn: raw.first_appeared_in_issue?.name ?? "",
  globalAppearances: Number(raw.count_of_issue_appearances) || 0,
  siteUrl: raw.site_detail_url ?? "",
});

// Merging summaries with issue details - used when IssueSummary is missing the elements that IssueDetail contains
export const mergeSummary = (summary: IssueSummary, detail: any): IssueSummary => ({
  ...summary,
  name: summary.name || detail.name || "",
  datePublished:
    summary.datePublished || detail.store_date || detail.cover_date || "",
  coverImage: summary.coverImage || imageUrl(detail.image),
});



// Details for singular issue, merged with existing summary
export const withCredits = (summary: IssueSummary, detail: any): Issue => ({
  ...mergeSummary(summary, detail),
  characters: (detail.character_credits ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
  })),
  credits: (detail.person_credits ?? [])
    .filter((p: any) => p?.id && p?.name)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      roles: rolesOf(p),
    })),
  tags: [],
});
