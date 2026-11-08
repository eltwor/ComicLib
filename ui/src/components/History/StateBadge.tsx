import type { IconType } from "react-icons";
import {
  IoBookOutline,
  IoCheckmarkCircle,
  IoCheckmarkCircleOutline,
  IoContrastOutline,
  IoEllipseOutline,
  IoRemoveOutline,
} from "react-icons/io5";
import type { VolumeState } from "../../types";

const states: Record<
  VolumeState,
  { label: string; icon: IconType; className: string; title: string }
> = {
  complete: {
    label: "Finished",
    icon: IoCheckmarkCircle,
    className: "text-accent-soft",
    title: "Every issue read; series finished",
  },
  "caught-up": {
    label: "Caught up",
    icon: IoCheckmarkCircleOutline,
    className: "text-accent-soft",
    title: "Every released issue read; series ongoing",
  },
  reading: {
    label: "Reading",
    icon: IoBookOutline,
    className: "text-body",
    title: "Currently reading",
  },
  partial: {
    label: "Partial",
    icon: IoContrastOutline,
    className: "text-muted",
    title: "Some issues read",
  },
  "to-read": {
    label: "To read",
    icon: IoEllipseOutline,
    className: "text-muted",
    title: "Bookmarked, none read",
  },
  untouched: {
    label: "Untouched",
    icon: IoRemoveOutline,
    className: "text-dim",
    title: "No reading activity",
  },
};

export function StateBadge({ state }: { state: VolumeState }) {
  const { label, icon: Icon, className, title } = states[state];

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] ${className}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}
