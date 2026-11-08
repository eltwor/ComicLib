import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CharacterDetail } from "../types";
import { buttonClass } from "../ui";

export function CharacterPage() {
  const { id } = useParams();
  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setCharacter(null);

    fetch(`/api/character/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(setCharacter)
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!character) return <p className="text-muted">Loading character…</p>;

  return (
    <>
      <Link
        to="/characters"
        className="mb-4 inline-block text-sm text-muted transition-colors hover:text-accent"
      >
        ← Characters
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <div className="w-full max-w-56 shrink-0 sm:w-56">
          {character.image ? (
            <img
              src={character.image}
              alt={`${character.name} portrait`}
              className="w-full rounded-lg object-cover shadow-[0_10px_30px_-10px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-raised px-3 text-center text-sm text-muted">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.25em] text-muted">
            Character
          </p>
          <h1 className="font-display text-[2.5rem] font-medium leading-[1.1] tracking-[-0.01em] text-accent">
            {character.name}
          </h1>
          {character.realName && (
            <p className="mt-1 text-xl text-body">{character.realName}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            {[
              character.publisher,
              character.firstAppearedIn
                ? `First appeared in ${character.firstAppearedIn}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-md bg-surface px-3 py-1.5 font-mono tabular-nums text-body">
              {character.issueCount} pulled issue
              {character.issueCount === 1 ? "" : "s"}
            </span>
            <span className="rounded-md bg-surface px-3 py-1.5 font-mono tabular-nums text-muted">
              {character.globalAppearances.toLocaleString()} appearances overall
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/characters?a=${character.id}`} className={buttonClass}>
              Find pulled issues
            </Link>
            {character.siteUrl && (
              <a
                href={character.siteUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClass}
              >
                Open on ComicVine
              </a>
            )}
          </div>
        </div>
      </div>

      {character.deck && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-xl font-medium text-body">About</h2>
          <p className="max-w-3xl text-body/90">{character.deck}</p>
        </section>
      )}

      {character.aliases.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-xl font-medium text-body">Aliases</h2>
          <div className="flex flex-wrap gap-1.5">
            {character.aliases.map((alias) => (
              <span
                key={alias}
                className="rounded bg-raised px-2 py-0.5 text-xs text-muted"
              >
                {alias}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
