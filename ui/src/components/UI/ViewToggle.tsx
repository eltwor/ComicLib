type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function ViewToggle<T extends string>({
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 text-sm transition-colors ${
            value === option.value
              ? "bg-accent/10 text-accent-soft"
              : "text-muted hover:text-body"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
