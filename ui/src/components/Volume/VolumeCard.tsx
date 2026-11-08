import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { VolumeSummary } from "../../types";

type Props = {
  volume: VolumeSummary;
  subtitle?: string;
  action?: ReactNode;
};

export function VolumeCard({ volume, subtitle, action }: Props) {
  return (
    <div className="@container group relative">
      <Link
        to={`/volume/${volume.id}`}
        className="block overflow-hidden rounded-xl border border-line bg-surface shadow-[0_0_2px_rgba(0,0,0,0.25),0_10px_24px_-8px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:-translate-y-1 hover:border-accent/60"
      >
        <div className="relative aspect-[450/691]">
          {volume.coverImage ? (
            <img
              src={volume.coverImage}
              alt={`${volume.name} cover`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-raised px-3 text-center text-sm text-muted">
              No cover
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/55 to-transparent px-3 pb-3 pt-24">
            <h3 className="line-clamp-2 text-[clamp(1rem,7.5cqw,1.75rem)] font-semibold leading-snug text-white">
              {volume.name}
            </h3>
            <p className="mt-0.5 text-[clamp(0.8rem,3.5cqw,1rem)] text-white/65">
              {subtitle ?? `${volume.numberOfIssues} issues · ${volume.startYear}`}
            </p>
          </div>
        </div>
      </Link>
      {action && <div className="absolute right-2 top-2">{action}</div>}
    </div>
  );
}
