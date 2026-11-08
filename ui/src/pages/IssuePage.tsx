import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IoRefreshOutline, IoTrashOutline } from "react-icons/io5";
import type { IssueData, PersonCredit } from "../types";
import { useDialog } from "../components/UI/DialogProvider";
import { IconButton } from "../components/UI/IconButton";

const arrowClass =
  "flex h-10 items-center justify-center rounded-md border border-line bg-surface text-lg text-body transition-colors hover:border-accent hover:text-accent";

const arrowOffClass =
  "flex h-10 items-center justify-center rounded-md border border-line/60 bg-surface/40 text-lg text-muted/40";

const ARTIST_ROLES = new Set(["penciller", "inker", "colorist", "artist"]);
const creditRoles = (person: PersonCredit) => person.roles ?? [];
const hasArtistRole = (person: PersonCredit) =>
  creditRoles(person).some((role) => ARTIST_ROLES.has(role));

export function IssuePage() {
  const { id, issueId } = useParams();
  const [data, setData] = useState<IssueData | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { confirm } = useDialog();

  const load = () => {
    setError("");
    return fetch(`/api/volume/${id}/issues/${issueId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  };

  const refreshDetail = async () => {
    const r = await fetch(`/api/volume/${id}/issues/${issueId}/refresh`, {
      method: "POST",
    });
    if (!r.ok) return setError(`API ${r.status}`);
    load(); // show the fresh data
  };

  const forgetDetail = async () => {
    const ok = await confirm(
      "Forget this issue's cached details? They will be refetched next time you open it.",
      { title: "Forget issue detail", confirmLabel: "Forget" },
    );
    if (!ok) return;
    const r = await fetch(`/api/issue/${issueId}/cache`, { method: "DELETE" });
    if (!r.ok) return setError(`API ${r.status}`);
    navigate(`/volume/${id}`); // do NOT load() — that would refetch immediately
  };

  useEffect(() => {
    load();
  }, [id, issueId]);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!data) return <p className="text-muted">Loading issue…</p>;

  const setReadAt = async (date: string) => {
    const url = date
      ? `/api/library/issue/${issueId}/read?date=${date}`
      : `/api/library/issue/${issueId}/unread`;
    const r = await fetch(url, { method: "POST" });
    if (!r.ok) return setError(`API ${r.status}`);
    load();
  };

  const writers = data.credits.filter((p) => creditRoles(p).includes("writer"));
  const artists = data.credits.filter(hasArtistRole);
  const covers = data.credits.filter((p) => creditRoles(p).includes("cover"));
  const creditCount = writers.length + artists.length + covers.length;

  return (
    <>
      <Link
        to={`/volume/${id}`}
        className="mb-4 inline-block text-sm text-muted transition-colors hover:text-accent"
      >
        ← Back to volume
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <div className="w-full max-w-56 shrink-0 sm:w-56">
          {data.coverImage ? (
            <img
              src={data.coverImage}
              alt={`Issue #${data.issueNumber} cover`}
              className="w-full rounded-lg object-cover shadow-[0_10px_30px_-10px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <div className="flex w-full items-center justify-center rounded-lg bg-raised px-3 text-center text-sm text-muted [aspect-ratio:450/691]">
              No cover
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {data.prevIssue ? (
              <Link
                to={`/volume/${id}/issues/${data.prevIssue.id}`}
                className={arrowClass}
                aria-label={`Previous issue #${data.prevIssue.issueNumber}`}
              >
                ←
              </Link>
            ) : (
              <span className={arrowOffClass} aria-hidden="true">
                ←
              </span>
            )}
            {data.nextIssue ? (
              <Link
                to={`/volume/${id}/issues/${data.nextIssue.id}`}
                className={arrowClass}
                aria-label={`Next issue #${data.nextIssue.issueNumber}`}
              >
                →
              </Link>
            ) : (
              <span className={arrowOffClass} aria-hidden="true">
                →
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.25em] text-muted">
            Issue
          </p>
          <h1 className="font-display text-4xl font-medium leading-[1.1] tracking-[-0.01em] text-accent">
            #{data.issueNumber}
          </h1>
          <p className="mt-1 text-xl text-body">{data.name || "Untitled"}</p>
          <p className="mt-2 font-mono text-sm tabular-nums text-muted">
            Published {data.datePublished || "unknown"}
          </p>

          <label className="mt-4 flex w-fit items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-body">
            Read at:
            <input
              type="date"
              value={data.readAt ?? ""}
              onChange={(e) => setReadAt(e.target.value)}
              className="rounded border border-line bg-base px-2 py-1 text-sm text-body focus:border-accent focus:outline-none"
            />
          </label>

          <div className="mt-3 flex gap-2">
            <IconButton label="Refresh detail" onClick={refreshDetail}>
              <IoRefreshOutline className="h-4 w-4" />
            </IconButton>
            <IconButton label="Forget detail" onClick={forgetDetail} danger>
              <IoTrashOutline className="h-4 w-4" />
            </IconButton>
          </div>

          {creditCount === 0 ? (
            <p className="mt-5 text-sm text-muted">
              No writer, artist, or cover credits on this issue.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <CreditGroup label="Writers" people={writers} role="writer" />
              <CreditGroup label="Artists" people={artists} role="artist" />
              <CreditGroup label="Cover" people={covers} role="cover" />
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-medium text-body">
          Characters
        </h2>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Character</th>
              </tr>
            </thead>
            <tbody>
              {data.characters.length === 0 && (
                <tr>
                  <td colSpan={1} className="px-4 py-6 text-center text-muted">
                    No character credits on this issue.
                  </td>
                </tr>
              )}
              {data.characters.map((character) => (
                <tr key={character.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <Link
                      to={`/character/${character.id}`}
                      className="text-body transition-colors hover:text-accent"
                    >
                      {character.name}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CreditGroup({
  label,
  people,
  role,
}: {
  label: string;
  people: PersonCredit[];
  role: string;
}) {
  if (people.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 text-xs uppercase tracking-wider text-muted">
        {label}
      </h2>
      <ul className="space-y-1 text-body/90">
        {people.map((person) => {
          const roles = creditRoles(person);
          return (
            <li key={person.id}>
              <Link
                to={`/creators?creator=${person.id}&role=${role}`}
                className="transition-colors hover:text-accent"
              >
                {person.name}
              </Link>
              {roles.length > 0 && (
                <span className="text-muted"> · {roles.join(", ")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
