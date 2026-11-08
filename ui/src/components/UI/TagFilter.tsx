type Props = {
  tags: string[];
  value: string | null;
  onChange: (tag: string | null) => void;
};

export function TagFilter({ tags, value, onChange }: Props) {
  if (tags.length === 0) return null;

  const chip = (active: boolean) =>
    `rounded-md px-2 py-0.5 text-xs transition-colors ${
      active
        ? "bg-accent/10 text-accent-soft"
        : "bg-surface text-muted hover:text-body"
    }`;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.09em] text-dim">
        Tags
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={chip(value === null)}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onChange(value === tag ? null : tag)}
          aria-pressed={value === tag}
          className={chip(value === tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
