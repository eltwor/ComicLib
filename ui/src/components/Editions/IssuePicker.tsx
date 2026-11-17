import { useEffect, useState } from "react";
import type { IssueSummary, VolumeSummary } from "../../types";
import { buttonClass } from "../../ui";

type Props = {
  existingIds: number[];
  onSubmit: (ids: number[]) => Promise<void>;
  onCancel: () => void;
};

export function IssuePicker({ existingIds, onSubmit, onCancel }: Props) {
  const [volumes, setVolumes] = useState<VolumeSummary[]>([]);
  const [volumeId, setVolumeId] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<IssueSummary[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const already = new Set(existingIds); // ids already in the edition

  useEffect(() => {
    let cancelled = false;
    fetch("/api/library")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((rows: VolumeSummary[]) => {
        if (cancelled) return;
        setVolumes(
          rows
            .filter((v) => !v.ignored)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const chooseVolume = async (id: number) => {
    setVolumeId(id);
    setSummaries(null);
    setError("");
    try {
      const r = await fetch(`/api/volume/${id}`);
      if (!r.ok) throw new Error(`API ${r.status}`);
      const data = await r.json();
      setSummaries(data.summaries);
    } catch (e) {
      setError(String(e));
    }
  };

  const toggle = (id: number) => {
    const next = new Set(picked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setPicked(next);
  };

  const confirm = async () => {
    if (picked.size === 0) return;
    setSaving(true);
    try {
      await onSubmit([...picked]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 rounded-xl border border-line bg-surface p-4">
      <select
        aria-label="Volume"
        value={volumeId ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "") {
            setVolumeId(null);
            setSummaries(null);
            setError("");
            return;
          }
          chooseVolume(Number(value));
        }}
        className="w-full rounded-lg border border-line/60 bg-base px-3 py-2 text-body outline-none focus:border-accent"
      >
        <option value="">Choose a volume…</option>
        {volumes.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.startYear})
          </option>
        ))}
      </select>

      {error ? (
        <p className="mt-3 text-sm text-rose-400">{error}</p>
      ) : summaries === null ? (
        <p className="mt-3 text-sm text-muted">
          {volumeId === null
            ? "Pick a volume to see its issues."
            : "Loading issues…"}
        </p>
      ) : summaries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No issues cached for this volume.
        </p>
      ) : (
        <ul className="mt-3 max-h-[360px] list-none overflow-y-auto p-0">
          {summaries.map((issue) => {
            const inEdition = already.has(issue.id);
            return (
              <li key={issue.id} className="border-t border-line/40">
                <label className="flex items-center gap-3 px-1 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={inEdition || picked.has(issue.id)}
                    disabled={inEdition}
                    onChange={() => toggle(issue.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="font-mono text-dim">
                    #{issue.issueNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {issue.name || "Untitled"}
                  </span>
                  <span className="text-xs text-dim">
                    {issue.datePublished}
                  </span>
                  {inEdition && (
                    <span className="text-[10px] uppercase tracking-[0.08em] text-dim">
                      in edition
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass}>
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={saving || picked.size === 0}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Adding…" : `Add ${picked.size}`}
        </button>
      </div>
    </div>
  );
}
