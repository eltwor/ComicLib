import { useId, useState } from "react";
import { IoClose } from "react-icons/io5";
import { DEFAULT_TAGS } from "../../tags";

type Props = {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
};

export function TagInput({ tags, onAdd, onRemove }: Props) {
  const [value, setValue] = useState("");
  const listId = useId();

  const submit = () => {
    const clean = value.trim();
    if (!clean) return;
    onAdd(clean);
    setValue("");
  };

  const suggestions = DEFAULT_TAGS.filter(
    (tag) => !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase()),
  );

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-raised px-2 py-0.5 text-xs text-muted"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-dim transition-colors hover:text-rose-400"
            >
              <IoClose className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          list={listId}
          aria-label="Add a volume tag"
          placeholder="Add tag…"
          className="w-32 rounded-md border border-line bg-surface px-2 py-1 text-xs text-body placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <datalist id={listId}>
        {DEFAULT_TAGS.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-[0.09em] text-dim">
            Suggestions
          </span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onAdd(tag)}
              className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-accent"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
