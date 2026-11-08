import {
  IoRefreshOutline,
  IoTrashOutline,
  IoStarOutline,
  IoStar,
  IoCopyOutline,
  IoDownloadOutline,
} from "react-icons/io5";
import type { IndexJobStatus, NextRelease, VolumeDetail } from "../../types";
import { buttonClass, formatShortDate } from "../../ui";
import { IconButton } from "../UI/IconButton";
import { TagInput } from "../UI/TagInput";

type VolumeHeroProps = {
  volume: VolumeDetail;
  read: number;
  detailsCached: number;
  reading: boolean;
  ignored: boolean;
  ongoing: boolean;
  favourite: boolean;
  onToggleReading: () => void;
  onToggleIgnored: () => void;
  onToggleOngoing: () => void;
  onToggleFavourite: () => void;
  nextRelease: NextRelease;
  nextReleaseOverride: string | null;
  onSetNextRelease: (date: string | null) => void;
  onAdvanceNextRelease: () => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onCopyYaml: () => void;
  onRefresh: () => void;
  onForget: () => void;
  bulkDate: string;
  onBulkDate: (value: string) => void;
  onMarkAllRead: () => void;
  firstReadAt: string | null;
  lastReadAt: string | null;
  missingDetails: number;
job: IndexJobStatus | null;
onDeepFetch: () => void;
};



export function VolumeHero({
  volume,
  read,
  detailsCached,
  reading,
  ignored,
  ongoing,
  favourite,
  onToggleReading,
  onToggleIgnored,
  onToggleOngoing,
  onToggleFavourite,
  nextRelease,
  nextReleaseOverride,
  onSetNextRelease,
  onAdvanceNextRelease,
  tags,
  onAddTag,
  onRemoveTag,
  onCopyYaml,
  onRefresh,
  onForget,
  bulkDate,
  onBulkDate,
  onMarkAllRead,
  firstReadAt,
  lastReadAt,
  missingDetails,
  job,
  onDeepFetch
}: VolumeHeroProps) {

  const thisVolumeJob =
  job?.running && job.kind === "volume" && job.volumeId === volume.id;

const otherJob = job?.running && !thisVolumeJob;

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:gap-6">
      <div className="relative shrink-0">
        {volume.coverImage ? (
          <img
            src={volume.coverImage}
            alt={`${volume.name} cover`}
            className="w-full max-w-44 shrink-0 rounded-lg object-cover shadow-[0_10px_30px_-10px_rgba(0,0,0,0.55)] sm:w-44"
          />
        ) : (
          <div className="flex w-full max-w-44 shrink-0 items-center justify-center rounded-lg bg-raised px-3 text-center text-sm text-muted [aspect-ratio:450/691] sm:w-44">
            No cover
          </div>
        )}
        <button
          type="button"
          onClick={onToggleFavourite}
          aria-label={
            favourite ? "Remove from favourites" : "Add to favourites"
          }
          aria-pressed={favourite}
          className={`absolute right-2 top-2 rounded-full bg-base/80 p-2 backdrop-blur transition-colors ${
            favourite ? "text-accent" : "text-white/75 hover:text-accent"
          }`}
        >
          {favourite ? (
            <IoStar className="h-4 w-4" />
          ) : (
            <IoStarOutline className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="font-display text-4xl font-medium leading-[1.1] tracking-[-0.01em] text-accent">
          {volume.name}
        </h1>
        <p className="mt-1 font-mono text-lg tabular-nums text-muted">
          {volume.startYear}
        </p>
        <p className="mt-3 font-mono text-sm tabular-nums text-muted">
          {read} of {volume.numberOfIssues} read · {detailsCached} of {detailsCached + missingDetails} details cached
        </p>
        {thisVolumeJob && (
  <p className="mt-1 font-mono text-xs tabular-nums text-dim">
    Fetching {job?.done} of {job?.total} details…
  </p>
)}

{otherJob && (
  <p className="mt-1 text-xs text-muted">
    {job?.kind === "volume"
      ? `Indexing ${job.volumeName}`
      : "Indexing read issues"}
  </p>
)}

        <span className="font-mono text-xs tabular-nums text-dim">
          {firstReadAt && `First read: ${firstReadAt}`}{" "}
          {lastReadAt && `· Last read ${lastReadAt}`}
        </span>

        {ongoing && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              Next release:{" "}
              <span className="font-mono tabular-nums text-body">
                {formatShortDate(nextRelease.date) || "unknown"}
              </span>
              {nextRelease.source === "derived" && nextRelease.date && (
                <span className="text-dim"> (estimated)</span>
              )}
              {nextRelease.source === "override" && (
                <span className="text-dim"> (set)</span>
              )}
            </span>

            <input
              type="date"
              value={nextReleaseOverride ?? ""}
              onChange={(e) => onSetNextRelease(e.target.value || null)}
              aria-label="Next release date"
              className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-body focus:border-accent focus:outline-none"
            />

            <button
              onClick={onAdvanceNextRelease}
              disabled={!nextRelease.date}
              className={`${buttonClass} disabled:opacity-40`}
            >
              Advance
            </button>
          </div>
        )}

        {volume.description && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-body/80">
            {volume.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={onToggleReading} className={buttonClass}>
            {reading ? "Not Reading" : "Reading"}
          </button>
          <button onClick={onToggleIgnored} className={buttonClass}>
            {ignored ? "Unignore" : "Ignore"}
          </button>
          <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-body">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={onToggleOngoing}
              className="h-4 w-4 accent-accent"
            />
            Ongoing
          </label>
          <IconButton label="Refresh issues" onClick={onRefresh}>
            <IoRefreshOutline className="h-4 w-4" />
          </IconButton>
          <IconButton label="Copy YAML" onClick={onCopyYaml}>
            <IoCopyOutline className="h-4 w-4" />
          </IconButton>
          <IconButton label="Forget volume" onClick={onForget} danger>
            <IoTrashOutline className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={
              thisVolumeJob
                ? `Fetching ${job?.done} / ${job?.total}`
                : otherJob
                  ? job?.kind === "volume"
                    ? `Indexing ${job.volumeName}`
                    : "Indexing read issues"
                  : missingDetails === 0
                    ? "All details cached"
                    : `Fetch ${missingDetails} details`
            }
            onClick={onDeepFetch}
            disabled={thisVolumeJob || otherJob || missingDetails === 0}
          >
            <IoDownloadOutline className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.09em] text-dim">
            Tags
          </span>
          <TagInput tags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted">
            Read all on:{" "}
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => onBulkDate(e.target.value)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-body focus:border-accent focus:outline-none"
            />
          </label>
          <button onClick={onMarkAllRead} className={buttonClass}>
            Mark all read
          </button>
        </div>
        {job?.error && !job.running && (
  <p className="mt-2 text-sm text-rose-400">
    Deep fetch stopped: {job.error}
  </p>
)}
      </div>
    </div>
  );
}
