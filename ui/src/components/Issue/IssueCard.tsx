import { Link } from "react-router-dom";
import type { IssueSummary } from "../../types";

type Props = {
  issue: IssueSummary;
  volumeId: number;
  onToggleRead: (issue: IssueSummary) => void;
};

export function IssueCard({ issue, volumeId, onToggleRead }: Props) {
  const isRead = issue.readAt !== null;

  return (
    <div className="group relative w-44 shrink-0 snap-start">
      <Link
        to={`/volume/${volumeId}/issues/${issue.id}`}
        className={`block overflow-hidden rounded-xl border border-line bg-surface shadow-[0_0_2px_rgba(0,0,0,0.25),0_10px_24px_-8px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 ${
          isRead ? "" : "opacity-45 grayscale hover:opacity-75"
        }`}
      >
        <div className="relative aspect-[450/691]">
          {issue.coverImage ? (
            <img
              src={issue.coverImage}
              alt={`Issue #${issue.issueNumber} cover`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-raised px-3 text-center text-sm text-muted">
              No cover
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent px-3 pb-3 pt-24">
            <p className="text-3xl font-bold leading-none tracking-tight text-white">
              #{issue.issueNumber}
            </p>
            <h3 className="mt-2 line-clamp-3 text-base font-medium leading-snug text-white/85">
              {issue.name || "Untitled"}
            </h3>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => onToggleRead(issue)}
        aria-label={
          isRead
            ? `Mark issue ${issue.issueNumber} unread`
            : `Mark issue ${issue.issueNumber} read`
        }
        title={isRead ? "Read — click to unread" : "Unread — click to mark read"}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
          isRead
            ? "border-accent bg-accent text-base"
            : "border-white/75 bg-black/40 text-transparent hover:border-accent hover:bg-black/60 hover:text-accent"
        }`}
      >
        {isRead ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="h-4 w-4"
          >
            <path d="m5 12 5 5L20 7" />
          </svg>
        ) : null}
      </button>
    </div>
  );
}
