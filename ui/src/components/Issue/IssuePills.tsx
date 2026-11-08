import { Fragment, useState } from "react";
import { Link } from "react-router-dom";

export type IssuePill = {
  id: number;
  issueNumber: number;
  readAt: string | null;
  title: string;
};

type Run = { read: boolean; items: IssuePill[] };

const buildRuns = (issues: IssuePill[]): Run[] => {
  const sorted = [...issues].sort((a, b) => a.issueNumber - b.issueNumber);
  const runs: Run[] = [];

  for (const issue of sorted) {
    const read = Boolean(issue.readAt);
    const current = runs[runs.length - 1];
    const previous = current?.items[current.items.length - 1];

    if (
      current &&
      previous &&
      current.read === read &&
      issue.issueNumber === previous.issueNumber + 1
    ) {
      current.items.push(issue);
    } else {
      runs.push({ read, items: [issue] });
    }
  }

  return runs;
};

const chipClass =
  "inline-flex h-6 items-center rounded-md px-2.5 font-mono text-xs tabular-nums transition-colors";
const rangeClass =
  "inline-flex h-6 items-center rounded-full px-2.5 font-mono text-xs font-semibold tabular-nums transition-colors";
const readChip = "bg-accent/15 text-accent-soft hover:bg-accent/25";
const offChip = "bg-raised text-muted hover:bg-raised/80 hover:text-body";

export function IssuePills({
  issues,
  volumeId,
  groupKey,
}: {
  issues: IssuePill[];
  volumeId: number;
  groupKey: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const runs = buildRuns(issues);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {runs.map((run) => {
        const first = run.items[0];
        const last = run.items[run.items.length - 1];
        const key = `${volumeId}|${groupKey}|${first.id}`;
        const isOpen = expanded.has(key);
        const state = run.read ? readChip : offChip;

        if (run.items.length >= 3 && !isOpen) {
          return (
            <button
              key={key}
              type="button"
              aria-expanded={false}
              title={`${run.items.length} issues, ${
                run.read ? "read" : "unread"
              } · #${first.issueNumber}–${last.issueNumber}. Click to show each issue.`}
              onClick={() => toggle(key)}
              className={`${rangeClass} ${state}`}
            >
              #{first.issueNumber}–{last.issueNumber}
              <span className="ml-1 text-[13px] font-medium opacity-60">+</span>
            </button>
          );
        }

        return (
          <Fragment key={key}>
            {run.items.map((issue) => (
              <Link
                key={issue.id}
                to={`/volume/${volumeId}/issues/${issue.id}`}
                title={issue.title}
                className={`${chipClass} ${issue.readAt ? readChip : offChip}`}
              >
                #{issue.issueNumber}
              </Link>
            ))}

            {run.items.length >= 3 && (
              <button
                type="button"
                aria-expanded={true}
                aria-label={`Collapse #${first.issueNumber} to #${last.issueNumber}`}
                title={`Collapse to #${first.issueNumber}–${last.issueNumber}`}
                onClick={() => toggle(key)}
                className="inline-flex h-6 items-center rounded-full border border-line px-2 text-xs text-muted transition-colors hover:text-body"
              >
                −
              </button>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
