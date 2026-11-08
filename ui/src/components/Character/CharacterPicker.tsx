import { useEffect, useState } from "react";
import type { CharacterMatch } from "../../types";

type PickerProps = {
  label: string;
  value: CharacterMatch | null;
  onChange: (value: CharacterMatch | null) => void;
  disabled?: boolean;
};

export function CharacterPicker({ label, value, onChange, disabled }: PickerProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CharacterMatch[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setError("");

    const t = setTimeout(() => {
      fetch(`/api/characters/search?q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!r.ok) throw new Error(`API ${r.status}`);
          return r.json();
        })
        .then((data: CharacterMatch[]) => {
          if (!cancelled) setSuggestions(data);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  if (value) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-muted">
          {label}
        </span>
        <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
          {value.image && (
            <img
              src={value.image}
              alt=""
              className="h-6 w-6 rounded object-cover"
            />
          )}
          <span className="text-body">{value.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 text-muted transition-colors hover:text-rose-400"
            aria-label={`Clear ${label}`}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="relative flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted">
        {label}
      </span>
      <input
        value={q}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={
          disabled ? "Pick the first character" : "Type a name or alias…"
        }
        className="w-72 rounded-md border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-40"
      />

      {open && !disabled && suggestions.length > 0 && (
        <div className="absolute top-full z-20 mt-1 max-h-80 w-80 overflow-auto rounded-lg border border-line bg-surface shadow-xl">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(suggestion);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-raised"
            >
              <span className="h-10 w-8 shrink-0 overflow-hidden rounded bg-raised">
                {suggestion.image && (
                  <img
                    src={suggestion.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">
                  {suggestion.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {suggestion.realName ||
                    suggestion.aliases.slice(0, 2).join(", ") ||
                    "—"}
                </span>
              </span>
              <span className="text-xs text-muted">{suggestion.issueCount}</span>
            </button>
          ))}
        </div>
      )}

      {error && <span className="text-xs text-rose-400">{error}</span>}
    </label>
  );
}
