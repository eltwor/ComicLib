import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SearchInput } from "../UI/SearchInput";
import { buttonClass } from "../../ui";
import type { CharacterCountRef } from "../../types";

const PAGE_SIZE = 25;

export function CharacterTable({
  characters,
}: {
  characters: CharacterCountRef[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const q = query.trim().toLowerCase();
  const filtered = characters
    .filter((character) => !q || character.name.toLowerCase().includes(q))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const shown = filtered.slice(start, start + PAGE_SIZE);
  const end = Math.min(start + PAGE_SIZE, filtered.length);

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium text-body">
            Characters
          </h2>
          <p className="mt-0.5 font-mono text-xs tabular-nums text-dim">
            {characters.length} characters
          </p>
        </div>
        {characters.length > 0 && (
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Filter characters…"
            className="w-64"
          />
        )}
      </div>

      {characters.length === 0 ? (
        <p className="text-sm text-muted">
          No character credits on this volume.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10.5px] uppercase tracking-[0.09em] text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Character</th>
                  <th
                    className="px-3 py-2 text-right font-medium"
                    title="Issues in this volume"
                  >
                    Issues
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-6 text-center text-muted"
                    >
                      No characters match.
                    </td>
                  </tr>
                ) : (
                  shown.map((character) => (
                    <tr
                      key={character.id}
                      className="odd:bg-surface/40 transition-colors hover:bg-raised/40"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/character/${character.id}`}
                          className="text-body transition-colors hover:text-accent hover:underline hover:underline-offset-4"
                        >
                          {character.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                        {character.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs tabular-nums text-dim">
              {filtered.length === 0
                ? "0 characters"
                : `${start + 1}–${end} of ${filtered.length}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className={`${buttonClass} disabled:opacity-40`}
              >
                ← Previous
              </button>
              <span className="font-mono text-xs tabular-nums text-dim">
                Page {currentPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage(Math.min(pageCount - 1, currentPage + 1))
                }
                disabled={currentPage >= pageCount - 1}
                className={`${buttonClass} disabled:opacity-40`}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
