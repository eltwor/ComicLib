import { useEffect, useState } from "react";
import type { EditionDetail, EditionDraft, EditionRow } from "../types";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/UI/PageHeader";
import { useDialog } from "../components/UI/DialogProvider";
import { EditionSingular } from "../components/Editions/EditionSingular";
import { progressWidth } from "../ui";
import { IconButton } from "../components/UI/IconButton";
import {
  IoAddOutline,
  IoCheckmarkCircleOutline,
  IoCreateOutline,
  IoEllipseOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { EditionForm } from "../components/Editions/EditionForm";
import { IssuePicker } from "../components/Editions/IssuePicker";

export function Editions() {
  const [rows, setRows] = useState<EditionRow[]>([]);
  const [detail, setDetail] = useState<EditionDetail | null>(null);
  const [form, setForm] = useState<"create" | "edit" | null>(null);
  // const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm } = useDialog();

  const selectedId = (() => {
    const id = Number(searchParams.get("edition"));
    return Number.isInteger(id) && id > 0 ? id : null;
  })();

  const loadRows = () => {
    setError("");
    return fetch(`/api/editions`)
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data: EditionRow[]) => {
        setRows(data);
      })
      .catch((e) => {
        setError(String(e));
      });
  };

  useEffect(() => {
    loadRows();
  }, []);


  const loadDetail = (id: number) =>
    fetch(`/api/editions/${id}`).then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}`);
      return r.json();
    });

  useEffect(() => {
    let cancelled = false;
    setError("");
    setDetail(null);
    if (selectedId === null) return;
    loadDetail(selectedId)
      .then((data: EditionDetail) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const create = async (draft: EditionDraft) => {
    try {
      const r = await fetch("/api/editions", {
        body: JSON.stringify(draft),
        method: "POST",
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const body = await r.json();
      const next = new URLSearchParams(searchParams);
      next.set("edition", String(body.id));
      setSearchParams(next);
    } catch (e) {
      setError(String(e));
      return false;
    }
    await loadRows();
    return true;
  };

  const save = async (id: number, draft: EditionDraft) => {
    try {
      const r = await fetch(`/api/editions/${id}`, {
        body: JSON.stringify(draft),
        method: "POST",
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
    } catch (e) {
      setError(String(e));
      return false;
    }
    setDetail(await loadDetail(id));
    await loadRows();
    return true;
  };

  const remove = async (id: number) => {
    const confirmed = await confirm(
      "This erases the edition and the grouping of issues, it doesn't delete the issue details. Do you want to proceed?",
      { title: "Delete edition", confirmLabel: "Yes, delete" },
    );
    if (!confirmed) return;
    try {
      const r = await fetch(`/api/editions/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`API ${r.status}`);
    } catch (e) {
      setError(String(e));
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("edition");
    setSearchParams(next);
    await loadRows();
  };

  const addIssues = async (ids: number[]) => {
    if (selectedId === null) return;
    const id = selectedId; // now `number` for the rest of the function
    try {
      const r = await fetch(`/api/editions/${id}/issues`, {
        body: JSON.stringify({ add: ids }),
        method: "POST",
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
    } catch (e) {
      setError(String(e));
      return false;
    }
    setDetail(await loadDetail(id));
    await loadRows();
    return true;
  };

  const removeIssues = async (ids: number[]) => {
    if (selectedId === null) return;
    try {
      const r = await fetch(`/api/editions/${selectedId}/issues`, {
        body: JSON.stringify({ remove: ids }),
        method: "POST",
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
    } catch (e) {
      setError(String(e));
      return;
    }
    setDetail(await loadDetail(selectedId));
    await loadRows();
  };

  const setCover = async (id: number, coverId: number) => {
  try {
    const r = await fetch(`/api/editions/${id}`, {
      body: JSON.stringify({ coverId }),
      method: "POST",
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
  } catch (e) {
    setError(String(e));
    return;
  }
  setDetail(await loadDetail(id));
  await loadRows();
};
  return (
    <>
      <PageHeader
        title="Editions"
        subtitle="Group issues in trades and other collections."
      />

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      {form === "create" && (
        <EditionForm
          submitLabel="Create"
          onSubmit={async (draft) => {
            const ok = await create(draft);
            if (ok) setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[304px_minmax(0,1fr)] lg:gap-x-10">
        <aside
          aria-label="Editions"
          className={`flex flex-col rounded-xl bg-surface p-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh_-_6rem)] ${
            selectedId !== null ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-0.5 text-[10.5px] uppercase tracking-[0.09em] text-dim">
            <IconButton label="Add edition" onClick={() => setForm("create")}>
              <IoAddOutline className="h-4 w-4" />
            </IconButton>

            <span>
              {rows.length} {rows.length === 1 ? "edition" : "editions"}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
            {rows.length === 0 ? (
              <p className="px-2.5 py-5 text-sm text-muted">
                No editions yet
              </p>
            ) : (
              rows.map((row) => (
                <EditionSingular
                  key={row.id}
                  edition={row}
                  active={selectedId === row.id}
                  onSelect={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("edition", String(row.id));
                    setSearchParams(next);
                  }}
                />
              ))
            )}
          </div>
        </aside>

        <section
          className={`min-w-0 ${selectedId !== null ? "block" : "hidden lg:block"}`}
        >
          {selectedId === null ? (
            <p className="py-10 text-sm text-muted">
              Select an edition to see its issues.
            </p>
          ) : !detail ? (
            <p className="py-8 text-sm text-muted">Loading edition…</p>
          ) : (
            <> 
            {form === "edit" && (
                <EditionForm
                  initial={{
                    name: detail.name,
                    format: detail.format,
                    owned: detail.owned,
                  }}
                  submitLabel="Save"
                  onSubmit={async (draft) => {
                    const ok = await save(detail.id, draft);
                    if (ok) setForm(null);
                  }}
                  onCancel={() => setForm(null)}
                />
              )}
              
              <h2
                aria-live="polite"
                className="font-display text-[28px] font-medium leading-[1.15] tracking-[-0.01em] text-body"
              >
                {detail.name}
              </h2>

              <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                {detail.format} · {detail.owned ? "owned" : "not owned"}
              </p>

              <p className="mt-0.5 font-mono text-xs tabular-nums text-dim">
                {detail.read} read · {detail.total} total
              </p>
              <span className="mt-2 block h-1 w-full max-w-md rounded-full bg-base">
                <span
                  className="block h-1 rounded-full bg-accent"
                  style={{ width: progressWidth(detail.read, detail.total) }}
                />
              </span>

              <div className="mt-4 flex flex-wrap gap-2">
                <IconButton
                  label="Edit edition"
                  onClick={() => {setForm("edit"); setPicking(false);}}
                >
                  <IoCreateOutline className="h-4 w-4" />
                </IconButton>
                <IconButton label="Add issues" onClick={() => { setPicking(true); setForm(null); }}>
                  <IoAddOutline className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Delete edition"
                  onClick={() => {
                    remove(detail.id);
                    setForm(null); setPicking(false)
                  }}
                  danger
                >
                  <IoTrashOutline className="h-4 w-4" />
                </IconButton>
              </div>
                {picking ? (
                  <IssuePicker
                    existingIds={detail.issues.map((i) => i.id)}
                    onSubmit={async (ids) =>    {
                      const ok = await addIssues(ids);
                      if (ok) setPicking(false);
                      }
                    }
                    onCancel={() => setPicking(false)}
                  />
                ): (
              <ul className="mt-5 list-none p-0">
                {detail.issues.length === 0 ? (
                  <li className="py-6 text-sm text-muted">
                    No issues in this edition yet.
                  </li>
                ) : (
                  detail.issues.map((issue, i) => {
                    const previous = detail.issues[i - 1];
                    const newVolume =
                      i === 0 || previous.volumeId !== issue.volumeId;

                    return (
                      <li
                        key={issue.id}
                        className="border-t border-line/60 py-2"
                      >
                        {newVolume && (
                          <p className="mb-1 text-[11px] uppercase tracking-[0.09em] text-dim">
                            {issue.volumeId === null ? (
                              "Volume ?"
                            ) : (
                              <Link
                                to={`/volume/${issue.volumeId}`}
                                className="transition-colors hover:text-accent"
                              >
                                {issue.volumeName ?? `Volume ${issue.volumeId}`}
                              </Link>
                            )}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-sm">
                          <button
                            type="button"
                            onClick={() => setCover(detail.id, issue.id)}
                            disabled={!issue.coverImage}
                            aria-pressed={issue.id === detail.coverId}
                            aria-label={`Use issue #${issue.issueNumber} as the cover`}
                            title={
                              issue.id === detail.coverId
                                ? "Current cover"
                                : "Set as cover"
                            }
                            className={`h-10 w-7 shrink-0 overflow-hidden rounded border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              issue.id === detail.coverId
                                ? "border-accent ring-1 ring-accent"
                                : "border-line/60 hover:border-accent"
                            }`}
                          >
                            {issue.coverImage ? (
                              <img
                                src={issue.coverImage}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center bg-raised text-[8px] text-dim">
                                —
                              </span>
                            )}
                          </button>
                          {issue.volumeId === null ? (
                            <span className="flex items-center gap-3 text-dim">
                              <span className="font-mono tabular-nums">
                                #{issue.issueNumber ?? "?"}
                              </span>
                              <span>
                                {issue.datePublished ||
                                  "no date"}
                              </span>
                            </span>
                          ) : (
                            <Link
                              to={`/volume/${issue.volumeId}/issues/${issue.id}`}
                              className="flex items-center gap-3 text-dim transition-colors hover:text-accent"
                            >
                              <span className="font-mono tabular-nums">
                                #{issue.issueNumber ?? "?"}
                              </span>
                              <span>
                                {issue.datePublished ||
                                  "no date"}
                              </span>
                            </Link>
                          )}
                          {issue.readAt ? (
                            <IoCheckmarkCircleOutline
                              className="h-4 w-4 text-accent"
                              title="Read"
                            />
                          ) : (
                            <IoEllipseOutline
                              className="h-4 w-4 text-dim"
                              title="Unread"
                            />
                          )}
                          <IconButton
                            label={`Remove issue #${issue.issueNumber} from this edition`}
                            onClick={() => {
                              removeIssues([issue.id]);
                            }}
                            danger
                          >
                            <IoTrashOutline className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
                )}
              
            </>
          )}
        </section>
      </div>
    </>
  );
}
