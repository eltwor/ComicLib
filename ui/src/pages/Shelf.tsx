import { useEffect, useState } from "react";
import type { VolumeSummary, VolumeState } from "../types";
import { VolumeCard } from "../components/Volume/VolumeCard";
import { PageHeader } from "../components/UI/PageHeader";
import { SearchInput } from "../components/UI/SearchInput";
import { TabBar } from "../components/UI/TabBar";
import { TagFilter } from "../components/UI/TagFilter";
import { IoRefreshOutline } from "react-icons/io5";
import { buttonClass, formatShortDate } from "../ui";

type TabKey = "all" | "favourites" | VolumeState;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "favourites", label: "Favourites" },
  { key: "reading", label: "Reading" },
  { key: "to-read", label: "To read" },
  { key: "caught-up", label: "Caught up" },
  { key: "partial", label: "Partial" },
  { key: "complete", label: "Finished" },
];

export function Shelf() {
  const [volumes, setVolumes] = useState<VolumeSummary[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const query = q.trim().toLowerCase();

  const load = () =>
    fetch("/api/library")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(setVolumes)
      .catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!volumes) return <p className="text-muted">Loading the shelf…</p>;

  const searched = volumes
    .filter((v) => v.name.toLowerCase().includes(query))
    .sort(
      (a, b) =>
        (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? "") ||
        a.name.localeCompare(b.name),
    );
  const availableTags = [...new Set(searched.flatMap((v) => v.tags))].sort();
  const matching = tagFilter
    ? searched.filter((v) => v.tags.includes(tagFilter))
    : searched;
  const visible =
    tab === "all"
      ? matching
      : tab === "favourites"
        ? matching.filter((v) => v.favourite)
        : matching.filter((v) => v.state === tab);

  const ordered =
    tab === "caught-up"
      ? [...visible].sort(
          (a, b) =>
            (a.nextRelease.date ?? "9999-12-31").localeCompare(
              b.nextRelease.date ?? "9999-12-31",
            ) || a.name.localeCompare(b.name),
        )
      : visible;

  const matchingRead = matching.reduce((sum, v) => sum + v.read, 0);
  const visibleRead = visible.reduce((sum, v) => sum + v.read, 0);
  const visibleUnread = visible.reduce(
    (sum, v) => sum + Math.max(0, v.numberOfIssues - v.read),
    0,
  );
  const activeLabel = TABS.find((entry) => entry.key === tab)?.label ?? "All";
  const tabs = TABS.map((entry) => ({
    value: entry.key,
    label: entry.label,
    count:
      entry.key === "all"
        ? matching.length
        : entry.key === "favourites"
          ? matching.filter((v) => v.favourite).length
          : matching.filter((v) => v.state === entry.key).length,
  }));

  const refreshOngoing = async () => {
    setRefreshing(true);
    setMessage("");
    try {
      const r = await fetch("/api/library/refresh", { method: "POST" });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const results: { added: number }[] = await r.json();
      const added = results.reduce((sum, x) => sum + x.added, 0);
      setMessage(
        added === 0
          ? "No new issues."
          : `${added} new issue${added === 1 ? "" : "s"} pulled.`,
      );
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Shelf"
        subtitle={<>Volumes you've started, finished, or plan to read.</>}
        meta={`${matching.length} volumes · ${matchingRead} issues read`}
        actions={
          <div className="flex flex-col items-center sm:flex-row">
            <button
              onClick={refreshOngoing}
              disabled={refreshing}
              className={`${
                refreshing ? `${buttonClass} border-rose-400` : buttonClass
              } disabled:opacity-40`}
            >
              <IoRefreshOutline
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              <span className="hidden sm:inline">
                {refreshing ? "Refreshing..." : "Refresh ongoing"}
              </span>
            </button>
            <span className="mt-1 block text-[10px] text-muted sm:hidden">
              {refreshing ? "Refreshing" : "Refresh"}
            </span>
          </div>
        }
        search={
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search volumes…"
          />
        }
      />

      {message && <p className="mb-3 text-sm text-accent">{message}</p>}

      <div className="mb-2 md:hidden">
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as TabKey)}
          aria-label="Shelf status"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-body focus:border-accent focus:outline-none"
        >
          {tabs.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label} ({entry.count})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-2 hidden md:block">
        <TabBar tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <TagFilter
        tags={availableTags}
        value={tagFilter}
        onChange={setTagFilter}
      />

      <p className="mb-5 font-mono text-xs tabular-nums text-dim">
        {visible.length} volumes · {visibleRead} read · {visibleUnread} unread
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted">
          {query || tagFilter
            ? "No volumes match."
            : tab === "all"
              ? "Nothing on the shelf yet."
              : tab === "favourites"
                ? "No favourite volumes yet."
                : `No volumes in ${activeLabel}.`}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {ordered.map((v) => (
            <VolumeCard
              key={v.id}
              volume={v}
              subtitle={`${v.read} of ${v.numberOfIssues} read${
                v.ongoing && v.nextRelease.date
                  ? ` · next ${formatShortDate(v.nextRelease.date)}`
                  : ""
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
