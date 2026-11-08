import { useEffect, useState } from "react";
import type { IssueSummary } from "../../types";
import { buttonClass } from "../../ui";
import { IssueTable } from "./IssueTable";
import { CardRow } from "./CardRow";
import { IssueCard } from "./IssueCard";
import { SearchInput } from "../UI/SearchInput";
import { ViewToggle } from "../UI/ViewToggle";

type IssueBrowserProps = {
  issues: IssueSummary[];
  volumeId: number;
  bulkDate: string;
  onBulkDate: (value: string) => void;
  onToggleRead: (issue: IssueSummary) => void;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function IssueBrowser({
  issues,
  volumeId,
  bulkDate,
  onBulkDate,
  onToggleRead,
  onChanged,
  onError,
}: IssueBrowserProps) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [issueQuery, setIssueQuery] = useState("");
  const q = issueQuery.trim().replace(/^#/, "");

  useEffect(() => {
    setSelected(new Set());
  }, [issueQuery]);

  const visible = q
    ? issues.filter((s) => String(s.issueNumber).includes(q))
    : issues;
  const unreadIssues = visible.filter((s) => s.readAt === null);
  const readIssues = visible.filter((s) => s.readAt !== null);

  const bulkUpdate = async (kind: "read" | "unread") => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const r = await fetch("/api/library/issues/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "read" ? { read: ids, date: bulkDate } : { unread: ids },
      ),
    });

    if (!r.ok) {
      onError(`API ${r.status}`);
      return;
    }
    setSelected(new Set());
    onChanged();
  };

  const toggleSelected = (issueId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected((prev) =>
      visible.every((s) => prev.has(s.id))
        ? new Set()
        : new Set(visible.map((s) => s.id)),
    );

  return (
    <>
      {visible.length === 0 && (
        <p className="text-sm text-muted">No issues match.</p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            { value: "cards", label: "Cards" },
            { value: "table", label: "Table" },
          ]}
        />
        <SearchInput
          value={issueQuery}
          onChange={setIssueQuery}
          placeholder="Search #..."
        />
      </div>

      {view === "table" ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted">
              Read on:{" "}
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => onBulkDate(e.target.value)}
                className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-body focus:border-accent focus:outline-none"
              />
            </label>
            <button
              onClick={() => bulkUpdate("read")}
              disabled={selected.size === 0}
              className={`${buttonClass} disabled:opacity-40`}
            >
              Mark selected read{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
            <button
              onClick={() => bulkUpdate("unread")}
              disabled={selected.size === 0}
              className={`${buttonClass} disabled:opacity-40`}
            >
              Mark selected unread
            </button>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-muted transition-colors hover:text-accent"
              >
                Clear selection
              </button>
            )}
          </div>
          <IssueTable
            issues={visible}
            selected={selected}
            onToggle={toggleSelected}
            onToggleAll={toggleSelectAll}
            onToggleRead={onToggleRead}
            volumeId={volumeId}
          />
        </>
      ) : (
        <>
          {unreadIssues.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-body">
                Issues ({unreadIssues.length})
              </h2>
              <CardRow count={unreadIssues.length}>
                {unreadIssues.map((s) => (
                  <IssueCard
                    key={s.id}
                    issue={s}
                    volumeId={volumeId}
                    onToggleRead={onToggleRead}
                  />
                ))}
              </CardRow>
            </section>
          )}

          {readIssues.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-body">
                Read Issues ({readIssues.length})
              </h2>
              <CardRow count={readIssues.length}>
                {readIssues.map((s) => (
                  <IssueCard
                    key={s.id}
                    issue={s}
                    volumeId={volumeId}
                    onToggleRead={onToggleRead}
                  />
                ))}
              </CardRow>
            </section>
          )}
        </>
      )}
    </>
  );
}
