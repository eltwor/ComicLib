import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreatorRow } from "../components/Creators/CreatorRow";
import { PageHeader } from "../components/UI/PageHeader";
import { ToggleSwitch } from "../components/UI/ToggleSwitch";
import { TabBar } from "../components/UI/TabBar";
import {
  VolumeResultRow,
  type VolumeResultGroup,
} from "../components/Volume/VolumeResultRow";
import type { IssuePill } from "../components/Issue/IssuePills";
import {
  IoChevronDown,
  IoChevronForward,
  IoRefreshOutline,
} from "react-icons/io5";
import { isCreative, type RoleFilter } from "../roles";
import { buttonClass } from "../ui";
import type {
  Coverage,
  CreatorMatch,
  CreatorMatchesResponse,
  CreatorSearchResponse,
  IndexJobStatus,
  RoleGroup,
  SearchIssue,
  SearchVolumeGroup,
} from "../types";

type SelectedCreator = CreatorSearchResponse["creator"] & {
  issueCount?: number;
  readCount?: number;
};

const EMPTY_COVERAGE: Coverage = { indexedRead: 0, readTotal: 0 };

const ROLE_TABS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "writer", label: "Writers" },
  { value: "artist", label: "Artists" },
  { value: "cover", label: "Cover" },
];

const ISSUE_GROUPS: { key: RoleGroup | "other"; label: string }[] = [
  { key: "writer", label: "Writer" },
  { key: "artist", label: "Artist" },
  { key: "cover", label: "Cover" },
  { key: "other", label: "Other" },
];

const toPill = (issue: SearchIssue): IssuePill => ({
  id: issue.id,
  issueNumber: issue.issueNumber,
  readAt: issue.readAt,
  title: `${issue.name || "Untitled"} · ${issue.datePublished || "no date"}${
    issue.roles.length ? ` · ${issue.roles.join(", ")}` : ""
  }`,
});

const resultGroups = (
  group: SearchVolumeGroup,
  role: RoleFilter,
): VolumeResultGroup[] => {
  if (role !== "all") {
    return [{ key: "flat", issues: group.issues.map(toPill) }];
  }

  return ISSUE_GROUPS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    issues: (entry.key === "other"
      ? group.issues.filter((issue) => issue.roleGroups.length === 0)
      : group.issues.filter((issue) =>
          issue.roleGroups.includes(entry.key as RoleGroup),
        )
    ).map(toPill),
  })).filter((entry) => entry.issues.length > 0);
};

export function Creators() {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<CreatorMatch[]>([]);
  const [coverage, setCoverage] = useState<Coverage>(EMPTY_COVERAGE);
  const [creativeOnly, setCreativeOnly] = useState(true);
  const [readOnly, setReadOnly] = useState(true);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [result, setResult] = useState<CreatorSearchResponse | null>(null);
  const [error, setError] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [job, setJob] = useState<IndexJobStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );
  const [filtersOpen, setFiltersOpen] = useState(isDesktop);
  const searchRef = useRef<HTMLInputElement>(null);

  const [role, setRole] = useState<RoleFilter>(() => {
    const fromUrl = searchParams.get("role");
    return fromUrl === "writer" || fromUrl === "artist" || fromUrl === "cover"
      ? fromUrl
      : "all";
  });

  const [selected, setSelected] = useState<SelectedCreator | null>(() => {
    const id = Number(searchParams.get("creator"));
    return Number.isInteger(id) && id > 0 ? { id, name: "", roles: [] } : null;
  });

  const visibleMatches = matches.filter(
    (match) => !creativeOnly || isCreative(match.roles),
  );
  const maxRead = visibleMatches.reduce(
    (max, match) => Math.max(max, match.readCount),
    1,
  );
  const activeMatch = selected
    ? visibleMatches.find((match) => match.id === selected.id)
    : undefined;
  const active =
    activeMatch ?? selected ?? (isDesktop ? (visibleMatches[0] ?? null) : null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      setIsDesktop(mq.matches);
      setFiltersOpen(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setError("");

    fetch(
      `/api/search/creators?q=${encodeURIComponent(debouncedQ.trim())}&role=${role}&favourite=${favouritesOnly ? "1" : "0"}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data: CreatorMatchesResponse) => {
        if (cancelled) return;
        setMatches(data.matches);
        setCoverage(data.coverage);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQ, role, refreshKey, favouritesOnly]);

  useEffect(() => {
    if (!active) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setResult(null);
    setError("");

    const params = new URLSearchParams({
      creator: String(active.id),
      role,
      read: readOnly ? "1" : "0",
    });

    fetch(`/api/search/issues?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data: CreatorSearchResponse) => {
        if (cancelled) return;
        setResult(data);
        setSelected((prev) =>
          prev && prev.id === data.creator.id
            ? { ...prev, name: data.creator.name, roles: data.creator.roles }
            : prev,
        );
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [active?.id, role, readOnly]);

  useEffect(() => {
    fetch("/api/index/read")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: IndexJobStatus | null) => {
        if (data) setJob(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(() => {
      fetch("/api/index/read")
        .then((r) => {
          if (!r.ok) throw new Error(`API ${r.status}`);
          return r.json();
        })
        .then((data: IndexJobStatus) => {
          setJob(data);
          if (!data.running) setRefreshKey((k) => k + 1);
        })
        .catch((e) => setError(String(e)));
    }, 1500);
    return () => clearInterval(t);
  }, [job?.running]);

  const startIndexing = async () => {
    setError("");
    try {
      const r = await fetch("/api/index/read", { method: "POST" });
      if (!r.ok) throw new Error(`API ${r.status}`);
      setJob(await r.json());
    } catch (e) {
      setError(String(e));
    }
  };

  const chooseCreator = (match: CreatorMatch) => {
    setSelected(match);
    setResult(null);
    const next = new URLSearchParams(searchParams);
    next.set("creator", String(match.id));
    next.set("role", role);
    setSearchParams(next);
  };

  const clearCreator = () => {
    setSelected(null);
    setResult(null);
    const next = new URLSearchParams(searchParams);
    next.delete("creator");
    setSearchParams(next);
  };

  const chooseRole = (nextRole: RoleFilter) => {
    setRole(nextRole);
    const next = new URLSearchParams(searchParams);
    next.set("role", nextRole);
    setSearchParams(next);
  };

  const resultIssueCount =
    result?.volumes.reduce((sum, group) => sum + group.issues.length, 0) ?? 0;
  const resultReadCount =
    result?.volumes.reduce(
      (sum, group) => sum + group.issues.filter((issue) => issue.readAt).length,
      0,
    ) ?? 0;
  const detailIssueCount = active?.issueCount ?? resultIssueCount;
  const detailReadCount = active?.readCount ?? resultReadCount;

  const toggleFavouriteCreator = async (id: number) => {
    try {
      const r = await fetch(`/api/favourites/creator/${id}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(`API ${r.status}`);

      const data: { favourite: boolean } = await r.json();

      if (favouritesOnly && !data.favourite) {
        setMatches((prev) => prev.filter((m) => m.id !== id));
        return;
      }
      setMatches((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, favourite: data.favourite } : m,
        ),
      );
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Creators"
        subtitle="Find issues by the people who wrote or drew them."
      />

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      <div className="mb-5">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.09em] text-dim transition-colors hover:text-muted lg:hidden"
        >
          {filtersOpen ? (
            <IoChevronDown className="h-4 w-4" />
          ) : (
            <IoChevronForward className="h-4 w-4" />
          )}
          Filtering
        </button>

        <div
          className={`${
            filtersOpen ? "flex" : "hidden"
          } flex-col gap-3 lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-3`}
        >
          <TabBar tabs={ROLE_TABS} value={role} onChange={chooseRole} />

          <ToggleSwitch
            label="Creative credits only"
            checked={creativeOnly}
            onChange={setCreativeOnly}
          />
          <ToggleSwitch
            label="Read issues only"
            checked={readOnly}
            onChange={setReadOnly}
          />

          <ToggleSwitch
            label="Favourites only"
            checked={favouritesOnly}
            onChange={setFavouritesOnly}
          />

          <span className="font-mono text-xs tabular-nums text-dim lg:ml-auto">
            {coverage.indexedRead} of {coverage.readTotal} read issues indexed
          </span>
        </div>
      </div>

      {coverage.indexedRead < coverage.readTotal && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted">
            Only {coverage.indexedRead} of {coverage.readTotal} read issues have
            cached credits. Indexing them will make these results complete.
          </p>
          <button
            onClick={startIndexing}
            disabled={job?.running}
            className={`${buttonClass} disabled:opacity-40`}
          >
            <IoRefreshOutline
              className={job?.running ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            {job?.running
              ? `Indexing ${job.done} / ${job.total}`
              : `Index read issues (${coverage.readTotal - coverage.indexedRead})`}
          </button>
        </div>
      )}

      {job?.running && (
        <p className="mb-4 text-xs text-muted">
          {job.fresh} new details fetched
        </p>
      )}

      {job?.error && !job.running && (
        <p className="mb-4 text-sm text-rose-400">
          Indexing stopped: {job.error}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[304px_minmax(0,1fr)] lg:gap-x-10">
        <aside
          aria-label="Creators"
          className={`flex flex-col rounded-xl bg-surface p-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh_-_6rem)] ${
            active ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="relative px-1 pb-2">
            <input
              ref={searchRef}
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelected(null);
                setResult(null);
                if (searchParams.has("creator")) {
                  const next = new URLSearchParams(searchParams);
                  next.delete("creator");
                  setSearchParams(next);
                }
              }}
              placeholder="Search creators…"
              autoComplete="off"
              aria-label="Search creators by name"
              className="h-9 w-full rounded-lg border border-line/60 bg-base px-3 pr-9 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-3 top-2 rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] font-semibold text-dim">
              /
            </kbd>
          </div>

          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-0.5 text-[10.5px] uppercase tracking-[0.09em] text-dim">
            <span>{q.trim() ? "Matches" : "Most read"}</span>
            <span>
              {visibleMatches.length}{" "}
              {visibleMatches.length === 1 ? "person" : "people"}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
            {visibleMatches.length === 0 ? (
              <p className="px-2.5 py-5 text-sm text-muted">
                {q.trim()
                  ? `No creators match “${q.trim()}”.`
                  : "No creators indexed yet."}
              </p>
            ) : (
              visibleMatches.map((match) => (
                <CreatorRow
                  key={match.id}
                  match={match}
                  active={active?.id === match.id}
                  maxRead={maxRead}
                  role={role}
                  onSelect={() => chooseCreator(match)}
                  favourite={match.favourite}
                  onToggleFavourite={() => toggleFavouriteCreator(match.id)}
                />
              ))
            )}
          </div>
        </aside>

        <section
          aria-live="polite"
          className={`min-w-0 ${active ? "block" : "hidden lg:block"}`}
        >
          {!active ? (
            <p className="py-10 text-sm text-muted">
              {visibleMatches.length === 0
                ? "No creators match."
                : "Select a creator to see their issues."}
            </p>
          ) : (
            <>
              <button
                onClick={clearCreator}
                className={`${buttonClass} mb-3 lg:hidden`}
              >
                ← All creators
              </button>

              <h2 className="font-display text-[28px] font-medium leading-[1.15] tracking-[-0.01em] text-body">
                {active.name || "Loading creator…"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {active.roles.join(", ") || "—"}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-dim">
                {detailReadCount} read · {detailIssueCount} indexed
                {result
                  ? ` · ${result.volumes.length} ${
                      result.volumes.length === 1 ? "volume" : "volumes"
                    }`
                  : ""}
              </p>

              {!result ? (
                <p className="py-8 text-sm text-muted">Loading issues…</p>
              ) : result.volumes.length === 0 ? (
                <p className="mt-5 py-7 text-sm text-muted">
                  No matching issues in the cached credits.
                </p>
              ) : (
                <ul className="mt-5 list-none p-0">
                  {result.volumes.map((group) => (
                    <VolumeResultRow
                      key={group.volumeId}
                      volume={group}
                      groups={resultGroups(group, role)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
