import { IoStar, IoStarOutline } from "react-icons/io5";
import { roleLetters, type RoleFilter } from "../../roles";
import type { CreatorMatch } from "../../types";

export function CreatorRow({
  match,
  active,
  maxRead,
  role,
  onSelect,
  onToggleFavourite,
  favourite,
}: {
  match: CreatorMatch;
  active: boolean;
  maxRead: number;
  role: RoleFilter;
  onSelect: () => void;
  onToggleFavourite: () => void;
  favourite: boolean;
}) {
  const letters = roleLetters(match.roles);
  const width = `${Math.max(
    4,
    Math.round((match.readCount / Math.max(1, maxRead)) * 100),
  )}%`;

  return (
    <div
      className={`relative isolate flex h-[38px] w-full items-center rounded-lg transition-colors ${
        active ? "bg-raised" : "hover:bg-raised/60"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 -z-10 rounded-lg ${
          active ? "bg-accent/20" : "bg-accent/10"
        }`}
        style={{ width }}
      />

      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        title={`${match.readCount} read of ${match.issueCount} indexed`}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 text-left"
      >
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            active ? "font-semibold text-accent-soft" : "text-body"
          }`}
        >
          {match.name}
        </span>

        <span className="flex shrink-0 gap-0.5 font-mono text-[10px] font-bold">
          {letters.map((letter) => (
            <span
              key={letter.key}
              title={letter.title}
              className={role === letter.group ? "text-accent" : "text-dim"}
            >
              {letter.label}
            </span>
          ))}
        </span>

        <span className="min-w-7 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
          {match.readCount === match.issueCount ? (
            match.readCount
          ) : (
            <>
              {match.readCount}
              <span className="text-muted/60"> / {match.issueCount}</span>
            </>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleFavourite}
        aria-label={favourite ? "Remove from favourites" : "Add to favourites"}
        aria-pressed={favourite}
        className={`mr-2 shrink-0 rounded p-1 transition-colors ${
          favourite ? "text-accent" : "text-dim hover:text-accent"
        }`}
      >
        {favourite ? (
          <IoStar className="h-3.5 w-3.5" />
        ) : (
          <IoStarOutline className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
