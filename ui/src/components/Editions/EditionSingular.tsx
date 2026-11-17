import type { EditionRow } from "../../types";
import { progressWidth } from "../../ui";
import { VolumeCover } from "../UI/VolumeCover";

type Props = { edition: EditionRow; active: boolean; onSelect: () => void };
export function EditionSingular({ edition, active, onSelect }: Props) {
  return (
    <div
      className={`relative isolate w-full rounded-lg transition-colors ${active ? "bg-raised" : "hover:bg-raised/60"}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
      >

        <VolumeCover size="sm" src={edition.coverImage} name={edition.name} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                active
                  ? "font-semibold text-accent-soft"
                  : edition.owned
                    ? "text-body"
                    : "text-muted"
              }`}
            >
              {edition.name}
            </span>

            <span
              className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.06em] ${
                edition.owned
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-line/60 text-dim"
              }`}
            >
              {edition.format}
            </span>
            <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-dim">
              {edition.read} / {edition.total}
            </span>
          </div>

          <span className="block h-1 w-full rounded-full bg-base">
            <span
              className="block h-1 rounded-full bg-accent"
              style={{ width: progressWidth(edition.read, edition.total) }}
            />
          </span>
        </div>
      </button>
    </div>
  );
}
