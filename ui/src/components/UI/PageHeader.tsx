import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, subtitle, actions, search, meta }: Props) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-[2.5rem] font-medium leading-[1.1] tracking-[-0.01em] text-accent">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        {meta && (
          <p className="mt-0.5 font-mono text-xs tabular-nums text-dim">
            {meta}
          </p>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        {actions}
        {search}
      </div>
    </div>
  );
}
