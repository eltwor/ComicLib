# Architecture Map

Read this when a file feels like it does too much, or when you need to know
where a new piece belongs.

## Layers, top to bottom

Backend modules live in `src/`; script launchers live in `scripts/`. Paths below
are relative to `src/` unless they start with `ui/` or `tests/`.

```
React pages (ui/src/pages)
  -> fetch /api/*
server.ts            transport: routes, JSON, access gate
server-ui.ts         static ui/dist + SPA fallback
index-job.ts         background read-index job state
http.ts              JSON response helper
session.ts           signed session token + cookie parsing (pure)
  -> comicvine.ts    HTTP fetchers, transforms, disk cache, in-memory list cache
  -> library.ts      personal overlay: read marks, flags, favourites, tags, next release
  -> release.ts      pure next-release date math
  -> search.ts       derived creator index + queries
  -> character.ts    derived character index + queries
  -> model.ts        domain model types + pure queries
cache/*.json + library.json
```

Rules:

- The UI never imports root Node modules. It speaks JSON only; `ui/src/types.ts` mirrors the wire.
- `server.ts` owns HTTP routing; it never calls ComicVine directly.
- `session.ts` owns token signing/verification and cookie parsing; it does no I/O and never sees a request object.
- `index-job.ts` owns the in-memory read-index job; `server-ui.ts` owns static UI serving.
- `comicvine.ts` is the only file that knows cache filenames and the API key, and the only place that invalidates the in-memory list cache.
- `library.ts` is the only file that writes `library.json`.
- `search.ts` and `character.ts` are derived views over cache + library.
- `model.ts` is the domain model. It should not do I/O.

## Files

| file | owns |
|---|---|
| `model.ts` | `Issue`, `Volume`, `PersonCredit`, `CharacterRef`, `Character`, pure queries |
| `comicvine.ts` | ComicVine fetchers, transforms, disk cache, volume/issue/character detail access |
| `library.ts` | `library.json`: read marks, volume flags, favourites, next-release override, volume tags, pure state rules |
| `release.ts` | pure release-date math (`nextReleaseAfter`, `advanceRelease`, `resolveNextRelease`; 28-day interval) |
| `credits.ts` | role token helpers (`rolesOf`, `isArtistRole`) |
| `search.ts` | creator index, creator matching, creator issue grouping |
| `character.ts` | character index, name/alias matching, co-occurrence grouping |
| `server.ts` | routes, JSON API |
| `server-ui.ts` | static `ui/dist`, MIME, SPA fallback |
| `index-job.ts` | in-memory read-index job state |
| `http.ts` | JSON response helper used by routes and static |
| `ui/src/types.ts` | wire types (deliberately duplicated from the server) |
| `ui/src/roles.ts` | UI-side role letters and the "creative credits" check |
| `ui/src/components` | domain folders: `UI/` primitives (`PageHeader`, `SearchInput`, `TabBar`, `ViewToggle`, `ToggleSwitch`, `TagInput`, `TagFilter`), `Volume/`, `Issue/`, `Character/`, `Creators/`, `History/` |
| `ui/src/tags.ts` | Obsidian tag presets (`ERA_TAGS`, `FILTER_TAGS`, `DEFAULT_TAGS`) |
| `ui/src/pages/*` | one route per page |
| `tests/fixtures.ts` | the seed fixture, out of production code |

## Cache files

| file | source | refreshed by |
|---|---|---|
| `publisher-10.json` | publisher index | Discovery "Refresh index" |
| `volume-<id>.json` | `/volume/4050-<id>/` | `refreshVolume` |
| `volume-<id>-issues-p<N>.json` | `/issues/?filter=volume` | `refreshVolume` |
| `issue-<id>.json` | `/issue/4000-<id>/` | `refreshIssueDetail` |
| `character-<id>.json` | `/character/4005-<id>/` | first character detail open |

All cache files are raw envelopes and disposable.

## Data flows

- **Volume page:** `GET /api/volume/:id` -> `getVolume` (volume + issue page caches) -> `withReadIss` (library overlay) + `volume.characters` + `nextRelease` (derived or override) + `tags` -> `VolumeHero`/`CharacterTable`. The library list route strips `characters` so shelf/gallery rows stay small.
- **Issue page:** `GET /api/volume/:vid/issues/:iid` -> `getIssueFromVolume` -> `getIssue` (issue cache) -> `withCredits` (credits + characters) -> neighbors from the volume list.
- **Creator search:** `GET /api/search/*` -> `getSearchContext` (details + summaries + volumes + library) -> `matchCreators` / `groupCreatorIssues`.
- **Character search:** `/characters` -> `GET /api/characters/search?q=` for pickers, `GET /api/characters/issues?a=&b=` for results, `GET /api/characters/cached` for the browse grid. `getCharacterContext` (cached issue details + cached character details + summaries + volumes + library) -> `matchCharacters` / `groupCharacterIssues`. `/character/:id` -> `GET /api/character/:id` -> `getCharacter` (cache or one API call). Character results cover every issue with cached **details**, read or not; issue stubs from a pulled volume do not carry credits until deep-fetched.
- **History monthly:** `GET /api/history/monthly` -> `readsByMonth` (pure) -> volume names and covers.

## Type ownership

- Server domain: `model.ts` (`Issue`, `Volume`, `PersonCredit`, `CharacterRef`, `Character`).
- Server-only derived: `search.ts` (`CreatorEntry`), `character.ts` (`CharacterEntry`).
- Wire: `ui/src/types.ts` duplicates the JSON shapes. This is deliberate; don't import root types into the UI.
- Raw cache data is `any` at the HTTP boundary; transforms (`withCredits`, `rawToVolume`, `rawToCharacter`) narrow it.

## Where to add things

| you want to... | put it in |
|---|---|
| call a new ComicVine endpoint | `comicvine.ts` fetcher |
| transform a raw response | `comicvine.ts` transform |
| change read/flag/favourite/tag/next-release semantics | `library.ts` pure core |
| change release-date arithmetic | `release.ts` |
| add a derived search/query | `search.ts` or `character.ts` |
| add an HTTP route | `server.ts` |
| add a page/route | `ui/src/pages/*` + `App.tsx` |
| add a wire shape | `ui/src/types.ts` |

## Known cleanup (planned, not blocking)

- Retire `findIssues`, `publishedYear`, `makeLabel` when the seed/tests no longer need them.
- Cache the creator/character index if search response time grows.
