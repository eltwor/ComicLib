import { useState, type FormEvent } from "react";
import type { EditionDraft, EditionFormat } from "../../types";
import { ToggleSwitch } from "../UI/ToggleSwitch";

// Mirrors EDITION_FORMATS in src/server.ts:115. The UI cannot import from src/
// (separate tsconfig, Node built-ins), so this duplication is deliberate —
// keep it adjacent to the <select> that consumes it.
export const EDITION_FORMATS: EditionFormat[] = [
  "single",
  "trade",
  "hc",
  "compact",
  "omnibus",
  "compendium",
];

type Props = {
  initial?: EditionDraft;
  submitLabel: string;
  onSubmit: (draft: EditionDraft) => Promise<void>;
  onCancel?: () => void;
};

export function EditionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<EditionDraft>(
    initial ?? {
      name: "",
      format: "trade",
      owned: false,
    },
  );
  const [saving, setSaving] = useState(false);
  const disabled = saving || draft.name.trim() === "";

  const updateDraft = <K extends keyof EditionDraft>(
    key: K,
    value: EditionDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setSaving(true);
    try {
      await onSubmit({ ...draft, name: draft.name.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex flex-1 min-w-[180px] flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-dim">
          Edition name
        </label>
        <input
          id="name"
          value={draft.name}
          onChange={(e) => updateDraft("name", e.target.value)}
          placeholder="Edition's name"
          className="rounded-lg border border-line/60 bg-base px-3 py-2 text-body outline-none transition placeholder:text-dim focus:border-accent"
        />
      </div>

      <div className="flex min-w-[140px] flex-col gap-1">
        <label htmlFor="format" className="text-sm font-medium text-dim">
          Format
        </label>
        <select
          id="format"
          value={draft.format}
          onChange={(e) => updateDraft("format", e.target.value as EditionFormat)}
          className="rounded-lg border border-line/60 bg-base px-3 py-2 text-body capitalize outline-none transition focus:border-accent"
        >
          {EDITION_FORMATS.map((f) => (
            <option key={f} value={f} className="capitalize">
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="flex h-[38px] items-center">
        <ToggleSwitch
          label="Owned"
          checked={draft.owned}
          onChange={(checked) => updateDraft("owned", checked)}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line bg-base px-4 py-2 font-medium text-body transition hover:bg-raised"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
