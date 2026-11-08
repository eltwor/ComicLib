import { Link } from "react-router-dom";
import { IssuePills, type IssuePill } from "../Issue/IssuePills";
import { VolumeCover } from "./VolumeCover";

export type VolumeSummary = {
  volumeId: number;
  name: string;
  startYear: number;
  coverImage: string;
};

export type VolumeResultGroup = {
  key: string;
  label?: string;
  issues: IssuePill[];
};

export function VolumeResultRow({
  volume,
  groups,
}: {
  volume: VolumeSummary;
  groups: VolumeResultGroup[];
}) {
  const visibleGroups = groups.filter((group) => group.issues.length > 0);
  const issueCount = new Set(
    visibleGroups.flatMap((group) => group.issues.map((issue) => issue.id)),
  ).size;

  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 border-b border-line/60 py-3 last:border-b-0">
      <VolumeCover src={volume.coverImage} name={volume.name} />

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <Link
            to={`/volume/${volume.volumeId}`}
            className="text-base font-semibold text-body transition-colors hover:text-accent hover:underline hover:underline-offset-4"
          >
            {volume.name}
          </Link>
          <span className="font-mono text-xs tabular-nums text-muted">
            {volume.startYear} · {issueCount} issue
            {issueCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {visibleGroups.map((group) => (
            <div
              key={group.key}
              className={
                group.label
                  ? "grid grid-cols-[62px_minmax(0,1fr)] items-start gap-2"
                  : ""
              }
            >
              {group.label && (
                <div className="text-[10.5px] uppercase leading-6 tracking-[0.09em] text-dim">
                  {group.label}
                </div>
              )}
              <IssuePills
                issues={group.issues}
                volumeId={volume.volumeId}
                groupKey={group.key}
              />
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}
