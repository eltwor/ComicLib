import { Link } from "react-router-dom";
import type { VolumeStub } from "../types";
import { useState, useEffect } from "react";
import { PageHeader } from "../components/UI/PageHeader";
import { SearchInput } from "../components/UI/SearchInput";
import { IoRefreshOutline } from "react-icons/io5";
import { buttonClass } from "../ui";

export type VolumeFlags = {
  ignored: number[];
  reading: number[];
  ongoing: number[];
};

export function Discovery() {
  const [volumes, setVolumes] = useState<VolumeStub[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
    const query = q.trim().toLowerCase();
  const [page, setPage] = useState(0);
  const [cached, setCached] = useState<Set<number>>(new Set());
  const [ignored, setIgnored] = useState<Set<number>>(new Set());
  const [reading, setReading] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/volumes")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(setVolumes)
      .catch((e) => setError(String(e)));
    fetch("/api/cached-volume-ids")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((ids) => setCached(new Set(ids)))
      .catch((e) => setError(String(e)));
    fetch("/api/library/volume-flags")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((f: VolumeFlags) => {
        setIgnored(new Set(f.ignored));
        setReading(new Set(f.reading));
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!volumes) return <p className="text-muted">Loading the DC index…</p>;

  const filtered = volumes
    .filter((v) => v.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);

  const rows: VolumeStub[][] = [];
  for (let i = 0; i < shown.length; i += COLS) {
    rows.push(shown.slice(i, i + COLS));
  }

  const searchChange = (q: string) => {
    setQ(q);
    setPage(0);
  }

  const refreshIndex = async () => {
    setRefreshing(true);
    setMessage("");
    try {
      const r = await fetch("/api/volumes/refresh", { method: "POST" });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const data: VolumeStub[] = await r.json();
      setVolumes(data);
      setPage(0);
      setMessage(`Index refreshed: ${data.length.toLocaleString()} volumes.`);
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const renderCell = (v: VolumeStub) => {
    const isIgnored = ignored.has(v.id);
    const isReading = reading.has(v.id);
    const isCached = cached.has(v.id);

    return (
      <div
        className={`flex min-w-0 items-center justify-between gap-2 px-3 py-2 ${
          isIgnored ? "opacity-40" : "transition-colors hover:bg-raised"
        }`}
      >
        <Link
          to={`/volume/${v.id}`}
          title={v.name}
          className={`truncate text-sm transition-colors ${
            isIgnored ? "text-muted" : "text-body hover:text-accent"
          }`}
        >
          {v.name}
        </Link>

        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isIgnored ? (
            <span
              className="text-xs text-rose-400"
              aria-label="Ignored"
              title="Ignored"
            >
              ✕
            </span>
          ) : isReading ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4 text-accent"
              role="img"
              aria-label="Reading"
            >
              <title>Reading</title>
              <path d="M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2z" />
              <path d="M22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z" />
            </svg>
          ) : isCached ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 text-emerald-400"
              role="img"
              aria-label="Pulled"
            >
              <title>Pulled</title>
              <path d="m5 12 5 5L20 7" />
            </svg>
          ) : null}
        </span>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Discovery"
        subtitle={<>{filtered.length.toLocaleString()} volumes in the DC index</>}
        actions={
          <div className="flex flex-col items-center sm:flex-row">
            <button
              onClick={refreshIndex}
              disabled={refreshing}
              className={`${buttonClass} disabled:opacity-40`}
            >
              <IoRefreshOutline
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              <span className="hidden sm:inline">
                {refreshing ? "Refreshing…" : "Refresh index"}
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
            onChange={searchChange}
            placeholder="Search volumes…"
          />
        }
      />

      {message && <p className="mb-3 text-sm text-accent">{message}</p>}

      <div className="overflow-hidden rounded-xl border border-line">
        {shown.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted">No matches</p>
        )}

        <div className="divide-y divide-line md:hidden">
          {shown.map((v, i) => (
            <div key={v.id} className={i % 2 === 0 ? "bg-surface/40" : ""}>
              {renderCell(v)}
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          {rows.map((row, ri) => (
            <div
              key={ri}
              className={`grid grid-cols-3 border-b border-line last:border-b-0 ${
                ri % 2 === 0 ? "bg-surface/40" : "bg-transparent"
              }`}
            >
              {row.map((v) => (
                <div key={v.id}>{renderCell(v)}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {filtered.length === 0
            ? "No matches"
            : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + shown.length} of ${filtered.length.toLocaleString()}`}
        </p>

        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-body transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-body"
          >
            ◀
          </button>
          <span className="text-sm text-muted">
            Page {page + 1} of {lastPage + 1}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-body transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-body"
          >
            ▶
          </button>
        </div>
      </div>
    </>
  );
}

const PAGE_SIZE = 100;
const COLS = 3;
