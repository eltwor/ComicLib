import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/UI/PageHeader";
import {
  VolumeResultRow,
  type VolumeResultGroup,
} from "../components/Volume/VolumeResultRow";
import { buttonClass } from "../ui";
import type {
  CharacterDetail,
  CharacterMatch,
  CharacterSearchResponse,
} from "../types";
import { CharacterPicker } from "../components/Character/CharacterPicker";

const toMatch = (character: CharacterDetail): CharacterMatch => ({
  id: character.id,
  name: character.name,
  realName: character.realName,
  image: character.image,
  aliases: character.aliases,
  deck: character.deck,
  detailCached: true,
  issueCount: character.issueCount,
});

export function Characters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [a, setA] = useState<CharacterMatch | null>(null);
  const [b, setB] = useState<CharacterMatch | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<CharacterSearchResponse | null>(null);
  const [cached, setCached] = useState<CharacterDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/characters/cached")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(setCached)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const aId = Number(searchParams.get("a"));
    const bId = Number(searchParams.get("b"));

    const load = async () => {
      try {
        if (Number.isInteger(aId) && aId > 0) {
          const ra = await fetch(`/api/character/${aId}`);
          if (!ra.ok) throw new Error(`API ${ra.status}`);
          setA(toMatch(await ra.json()));

          if (Number.isInteger(bId) && bId > 0) {
            const rb = await fetch(`/api/character/${bId}`);
            if (rb.ok) setB(toMatch(await rb.json()));
          }
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setHydrated(true);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!a) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ a: String(a.id) });
    if (b) params.set("b", String(b.id));

    fetch(`/api/characters/issues?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data: CharacterSearchResponse) => {
        if (!cancelled) setResult(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const next = new URLSearchParams({ a: String(a.id) });
    if (b) next.set("b", String(b.id));
    setSearchParams(next, { replace: true });

    return () => {
      cancelled = true;
    };
  }, [hydrated, a?.id, b?.id]);

  const chooseA = (match: CharacterMatch | null) => {
    setA(match);
    if (!match) {
      setB(null);
      setResult(null);
      setSearchParams(new URLSearchParams());
    }
  };

  const chooseB = (match: CharacterMatch | null) => setB(match);

  const totalIssues =
    result?.volumes.reduce((sum, group) => sum + group.issues.length, 0) ?? 0;
  const heading = result?.characters.map((c) => c.name).join(" + ") ?? "";

  return (
    <>
      <PageHeader
        title="Characters"
        subtitle="Find pulled issues with one character, or two together."
      />

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <CharacterPicker label="Character" value={a} onChange={chooseA} />
        <CharacterPicker
          label="Second character (optional)"
          value={b}
          onChange={chooseB}
          disabled={!a}
        />
      </div>

      {a ? (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-[28px] font-medium leading-[1.15] tracking-[-0.01em] text-body">
                {heading}
              </h2>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-dim">
                {totalIssues} pulled issue{totalIssues === 1 ? "" : "s"} ·{" "}
                {result?.volumes.length ?? 0} volume
                {(result?.volumes.length ?? 0) === 1 ? "" : "s"}
              </p>
            </div>
            <button onClick={() => chooseA(null)} className={buttonClass}>
              Clear
            </button>
          </div>

          {loading ? (
            <p className="py-8 text-sm text-muted">Finding issues…</p>
          ) : !result ? (
            <p className="py-8 text-sm text-muted">No results.</p>
          ) : result.volumes.length === 0 ? (
            <p className="mt-5 py-7 text-sm text-muted">
              No pulled issues with {a.name}
              {b ? ` and ${b.name}` : ""}.
            </p>
          ) : (
            <ul className="mt-5 list-none p-0">
              {result.volumes.map((group) => {
                const groups: VolumeResultGroup[] = [
                  {
                    key: "flat",
                    issues: group.issues.map((issue) => ({
                      id: issue.id,
                      issueNumber: issue.issueNumber,
                      readAt: issue.readAt,
                      title: `${issue.name || "Untitled"} · ${
                        issue.datePublished || "no date"
                      }`,
                    })),
                  },
                ];

                return (
                  <VolumeResultRow
                    key={group.volumeId}
                    volume={group}
                    groups={groups}
                  />
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section>
          <h2 className="mb-3 font-display text-xl font-medium text-body">
            Characters you've opened
          </h2>

          {!cached ? (
            <p className="text-muted">Loading characters…</p>
          ) : cached.length === 0 ? (
            <p className="text-muted">
              No character details cached yet. Open one from an issue.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {cached.map((character) => (
                <Link
                  key={character.id}
                  to={`/character/${character.id}`}
                  className="group @container relative block overflow-hidden rounded-xl border border-line bg-surface shadow-[0_0_2px_rgba(0,0,0,0.25),0_10px_24px_-8px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:-translate-y-1 hover:border-accent/60"
                >
                  <div className="relative aspect-[3/4]">
                    {character.image ? (
                      <img
                        src={character.image}
                        alt={character.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-raised px-3 text-center text-sm text-muted">
                        No image
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/55 to-transparent px-3 pb-3 pt-24">
                      <h3 className="line-clamp-2 text-[clamp(1rem,7.5cqw,1.75rem)] font-semibold leading-snug text-white">
                        {character.name}
                      </h3>
                      {character.realName && (
                        <p className="mt-0.5 line-clamp-1 text-[clamp(0.8rem,3.5cqw,1rem)] text-white/65">
                          {character.realName}
                        </p>
                      )}
                      <p className="mt-0.5 font-mono text-[clamp(0.75rem,3cqw,0.95rem)] tabular-nums text-white/55">
                        {character.issueCount} pulled issue
                        {character.issueCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

