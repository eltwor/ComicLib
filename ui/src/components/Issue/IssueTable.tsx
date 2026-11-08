import { useEffect, useRef } from "react";
import type { IssueSummary } from "../../types";
import { Link } from "react-router-dom";

type Props = {
  issues: IssueSummary[];
  selected: Set<number>;
  onToggle: (issueId: number) => void;
  onToggleAll: () => void;
  onToggleRead: (issue: IssueSummary) => void;
  volumeId: number;
};

export function IssueTable({
  issues,
  selected,
  onToggle,
  onToggleAll,
  onToggleRead,
  volumeId
}: Props) {
  const allRef = useRef<HTMLInputElement>(null);

  const allSelected =
    issues.length > 0 && issues.every((issue) => selected.has(issue.id));
  const someSelected = issues.some((issue) => selected.has(issue.id));

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="w-10 px-3 py-2">
              <input
                ref={allRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all visible issues"
                className="h-4 w-4 accent-accent"
              />
            </th>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Published</th>
            <th className="px-3 py-2 font-medium">Read</th>
            <th className="px-3 py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted">
                No issues match.
              </td>
            </tr>
          )}

          {issues.map((issue) => {
            const isRead = issue.readAt !== null;
            const isSelected = selected.has(issue.id);

            return (
              <tr
                key={issue.id}
                className={`border-t border-line ${
                  isSelected ? "bg-accent/10" : "bg-transparent"
                }`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(issue.id)}
                    aria-label={`Select issue ${issue.issueNumber}`}
                    className="h-4 w-4 accent-accent"
                  />
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/volume/${volumeId}/issues/${issue.id}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    #{issue.issueNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/volume/${volumeId}/issues/${issue.id}`}
                    className="text-body transition-colors hover:text-accent"
                  >
                    {issue.name || "Untitled"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted">
                  {issue.datePublished || "—"}
                </td>
                <td className="px-3 py-2 text-muted">{issue.readAt ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onToggleRead(issue)}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-body transition-colors hover:border-accent hover:text-accent"
                  >
                    {isRead ? "Mark unread" : "Mark read"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
