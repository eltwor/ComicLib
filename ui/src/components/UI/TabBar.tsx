type Tab<T extends string> = { value: T; label: string; count?: number };

type Props<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function TabBar<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-body"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`font-mono text-xs tabular-nums ${
                  active ? "text-accent-soft" : "text-dim"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
