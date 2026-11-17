import { Fragment, useEffect, useState } from "react";
import type { MonthlyHistoryRow, VolumeSummary } from "../types";
import { PageHeader } from "../components/UI/PageHeader";
import { Link } from "react-router-dom";
import { StateBadge } from "../components/History/StateBadge";
import { ViewToggle } from "../components/UI/ViewToggle";
import { VolumeCover } from "../components/UI/VolumeCover";
import { buttonClass } from "../ui";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatMonth = (month: string) => {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? month} ${year}`;
};

export function History() {
  const [volumes, setVolumes] = useState<VolumeSummary[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"timeline" | "monthly">("timeline");
  const [monthly, setMonthly] = useState<MonthlyHistoryRow[] | null>(null);
  const [monthlyError, setMonthlyError] = useState("");

  useEffect(() => {
    fetch("/api/library")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(setVolumes)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (view !== "monthly" || monthly) return;

    let cancelled = false;
    setMonthlyError("");

    fetch("/api/history/monthly")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data: MonthlyHistoryRow[]) => {
        if (!cancelled) setMonthly(data);
      })
      .catch((e) => {
        if (!cancelled) setMonthlyError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [view, monthly]);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!volumes) return <p className="text-muted">Loading history…</p>;

  const history = volumes
    .filter((v) => v.lastReadAt !== null)
    .sort((a, b) => (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? ""));

  const monthlyTotal = monthly?.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const maxMonthTotal = monthly
    ? Math.max(1, ...monthly.map((row) => row.total))
    : 1;

  return (
    <>
      <PageHeader
        title="History"
        subtitle={
          view === "timeline"
            ? `${history.length} volumes with a dated read, newest first.`
            : monthly
              ? `${monthlyTotal} issues read across ${monthly.length} months.`
              : "Issues read, grouped by month."
        }
        actions={
          <a href="/api/history/export.csv" className={buttonClass}>
            Export CSV
          </a>
        }
      />

      <div className="mb-4">
        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            { value: "timeline", label: "Timeline" },
            { value: "monthly", label: "Read by month" },
          ]}
        />
      </div>

      {view === "monthly" ? (
        monthlyError ? (
          <p className="text-rose-400">{monthlyError}</p>
        ) : !monthly ? (
          <p className="text-muted">Loading monthly reads…</p>
        ) : monthly.length === 0 ? (
          <p className="text-muted">No dated reads yet.</p>
        ) : (
          monthly.map((row) => (
            <MonthSection
              key={row.month}
              row={row}
              maxMonthTotal={maxMonthTotal}
            />
          ))
        )
      ) : history.length === 0 ? (
        <p className="text-muted">No dated reads yet.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.09em] text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Group</th>
                  <th className="px-3 py-2 font-medium">Last read</th>
                  <th className="px-3 py-2 text-right font-medium">Progress</th>
                  <th className="px-3 py-2 text-right font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {history.map((v) => (
                  <tr
                    key={v.id}
                    className="odd:bg-surface/40 transition-colors hover:bg-raised/40"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/volume/${v.id}`}
                        className="text-body transition-colors hover:underline hover:underline-offset-4"
                      >
                        {v.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted">
                      {v.lastReadAt}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                      {v.read} / {v.numberOfIssues}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <StateBadge state={v.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line md:hidden">
            {history.map((v) => (
              <li key={v.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/volume/${v.id}`}
                    className="text-body transition-colors hover:underline hover:underline-offset-4"
                  >
                    {v.name}
                  </Link>
                  <StateBadge state={v.state} />
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-xs tabular-nums text-muted">
                  <span>{v.lastReadAt}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {v.read} / {v.numberOfIssues}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function MonthSection({
  row,
  maxMonthTotal,
}: {
  row: MonthlyHistoryRow;
  maxMonthTotal: number;
}) {
  const [open, setOpen] = useState(true);
  const barWidth = `${Math.max(
    4,
    Math.round((row.total / Math.max(1, maxMonthTotal)) * 100),
  )}%`;

  return (
    <section className="py-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full flex-wrap items-center gap-2 text-left"
      >
        <span className="w-4 text-dim">{open ? "▾" : "▸"}</span>
        <h2 className="font-display text-xl font-medium text-body">
          {formatMonth(row.month)}
        </h2>
        <span className="font-mono text-xs tabular-nums text-dim">
          {row.total} issues · {row.groups.length} collections
          {row.groups.length === 1 ? "" : "s"}
        </span>
        <span
          aria-hidden="true"
          title={`${row.total} issues in ${formatMonth(row.month)}`}
          className="ml-auto flex h-1 w-24 items-center rounded-full bg-raised"
        >
          <span
            className="block h-1 rounded-full bg-accent"
            style={{ width: barWidth }}
          />
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.09em] text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Group</th>
                <th className="px-3 py-2 text-right font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>
              {row.groups.map((group) => (
                <MonthGroupRow key={`${group.kind}:${group.id}`} group={group} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MonthGroupRow({
  group,
}: {
  group: MonthlyHistoryRow["groups"][number];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer odd:bg-surface/40 transition-colors hover:bg-raised/40"
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-3">
            <VolumeCover
              size="sm"
              src={group.coverImage}
              name={group.name}
            />
            <span className="w-3 text-dim">{open ? "▾" : "▸"}</span>
            <Link
              to={group.kind === "edition"
  ? `/editions?edition=${group.id}`
  : `/volume/${group.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-body transition-colors hover:underline hover:underline-offset-4"
            >
              {group.name}
            </Link>
          </div>
        </td>
        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted">
          {group.count}
        </td>
      </tr>

      {open && (
        <tr className="bg-surface/30">
          <td colSpan={2} className="px-3 pb-3 pt-1">
            <div className="flex flex-wrap gap-1">
              {group.issues.map((issue, i) => {
                const newVolume =
                  group.kind === "edition" &&
                  group.issues[i - 1]?.volumeId !== issue.volumeId;

                return (
                  <Fragment key={issue.id}>
                    {newVolume && (
                      <p className="mt-1.5 w-full text-[10px] uppercase tracking-[0.09em] text-dim">
                        {issue.volumeName}
                      </p>
                    )}
                    <Link
                      to={`/volume/${issue.volumeId}/issues/${issue.id}`}
                      title={`Read ${issue.readAt}`}
                      className="inline-flex h-6 items-center rounded-md bg-accent/15 px-2 font-mono text-xs tabular-nums text-accent-soft transition-colors hover:bg-accent/25"
                    >
                      #{issue.issueNumber}
                    </Link>
                  </Fragment>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
