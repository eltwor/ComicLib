import { useState, useEffect } from "react";
import type { VolumeSummary } from "../types";
import { VolumeCard } from "../components/Volume/VolumeCard";
import { useDialog } from "../components/UI/DialogProvider";
import { PageHeader } from "../components/UI/PageHeader";
import { SearchInput } from "../components/UI/SearchInput";
import { IoTrashOutline } from "react-icons/io5";
import { IconButton } from "../components/UI/IconButton";

export function Gallery() {
  const [volumes, setVolumes] = useState<VolumeSummary[] | null>(null);
  const [error, setError] = useState("");
  const { confirm, alert } = useDialog();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const load = () =>
    fetch("/api/library")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(setVolumes)
      .catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!volumes) return <p className="text-muted">Loading the volumes…</p>;

  const forget = async (v: VolumeSummary) => {
    const confirmed = await confirm(
      `Forget ${v.name} (${v.numberOfIssues} issues) and its cached files?`,
      { title: "Forget volume", confirmLabel: "Forget" },
    );
    if (!confirmed) return;

    const alsoIgnore = await confirm(
      "Also mark it ignored, so Discovery keeps it greyed out as a duplicate you don't want?",
      { title: "Skip in future", confirmLabel: "Ignore it", cancelLabel: "No" },
    );

    const r = await fetch(`/api/library/${v.id}`, { method: "DELETE" });
    if (!r.ok) return setError(`API ${r.status}`);
    const removed = await r.json();
    if (alsoIgnore) {
      await fetch(`/api/library/volume/${v.id}/ignore`, { method: "POST" });
    }
    await alert(
      `Forgot ${v.name}: ${removed.volumeFiles} volume files, ${removed.issueFiles} issue files${alsoIgnore ? " — marked ignored" : ""}`,
      { title: "Forgotten" },
    );
    load();
  };

  const held = volumes.filter((v) => v.state === "untouched" && !v.ignored);
  const shown = held.filter((v) => v.name.toLowerCase().includes(query));
  const count = query ? shown.length : held.length;
  return (
    <>
      <PageHeader
        title="Gallery"
        subtitle={
          <>
            {query ? `${shown.length} of ${held.length}` : held.length}{" "}
            {count === 1 ? "volume" : "volumes"} pulled, untouched.{" "}
          </>
        }
        search={
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search volumes…"
          />
        }
      />

      {held.length === 0 && <p className="text-muted">Nothing cached yet.</p>}
      {shown.length === 0 && <p className="text-muted">No volumes match.</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
        {(query ? shown : held).map((v) => (
          <VolumeCard
            key={v.id}
            volume={v}
            action={
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                <IconButton
                  label={`Forget ${v.name}`}
                  onClick={() => forget(v)}
                  danger
                >
                  <IoTrashOutline className="h-4 w-4" />
                </IconButton>
              </div>
            }
          />
        ))}
      </div>
    </>
  );
}
