import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  IndexJobStatus,
  IssueSummary,
  NextRelease,
  VolumeDetail,
} from "../types";
import { useDialog } from "../components/UI/DialogProvider";
import { VolumeHero } from "../components/Volume/VolumeHero";
import { CharacterTable } from "../components/Character/CharacterTable";
import { IssueBrowser } from "../components/Issue/IssueBrowser";

type VolumeData = {
  volume: VolumeDetail;
  detailsCached: number;
  summaries: IssueSummary[];
  reading: boolean;
  ignored: boolean;
  ongoing: boolean;
  firstReadAt: string | null;
  lastReadAt: string | null;
  favourite: boolean;
  nextRelease: NextRelease;
  nextReleaseOverride: string | null;
  tags: string[];
};

type Toast = { message: string; tone: "ok" | "error" };

export function VolumePage() {
  const { id } = useParams();
  const [data, setData] = useState<VolumeData | null>(null);
  const [error, setError] = useState("");
  const [job, setJob] = useState<IndexJobStatus | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [bulkDate, setBulkDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const navigate = useNavigate();
  const { confirm } = useDialog();

  useEffect(() => {
    if (!toast) return;

    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const load = () => {
    setError("");
    return fetch(`/api/volume/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((d: VolumeData) => ({
        ...d,
        summaries: [...d.summaries].sort(
          (a, b) => (a.issueNumber || 0) - (b.issueNumber || 0) || a.id - b.id,
        ),
      }))
      .then(setData)
      .catch((e) => setError(String(e)));
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    fetch("/api/index/status")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((status) => {
        if (status) setJob(status);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!job?.running) return;

    const timer = window.setInterval(() => {
      fetch("/api/index/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((next) => {
          if (!next) return;
          setJob(next);
          if (!next.running) load();
        })
        .catch(() => {
          setJob(null);
          setToast({
            message: "Lost contact with the index job",
            tone: "error",
          });
        });
    }, 1500);

    return () => window.clearInterval(timer);
  }, [job?.running, id]);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!data) return <p className="text-muted">Loading volume…</p>;

  const post = async (path: string) => {
    const r = await fetch(path, { method: "POST" });
    if (!r.ok) throw new Error(`API ${r.status}`);
  };

  const toggleReading = async () => {
    try {
      await post(
        `/api/library/volume/${id}/${data.reading ? "not-reading" : "reading"}`,
      );
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleIgnored = async () => {
    try {
      await post(
        `/api/library/volume/${id}/${data.ignored ? "unignore" : "ignore"}`,
      );
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleOngoing = async () => {
    try {
      await post(
        `/api/library/volume/${id}/${data.ongoing ? "not-ongoing" : "ongoing"}`,
      );
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleRead = async (issue: IssueSummary) => {
    try {
      await post(
        `/api/library/issue/${issue.id}/${issue.readAt !== null ? "unread" : "read"}`,
      );
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleFavourite = async () => {
    try {
      await post(`/api/favourites/volume/${id}`);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const postVolume = async (path: string, body: unknown) => {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
  };

  const setNextRelease = async (date: string | null) => {
    try {
      await postVolume(`/api/library/volume/${id}/next-release`, { date });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const advanceNextRelease = async () => {
    try {
      await postVolume(`/api/library/volume/${id}/next-release`, {
        advance: true,
      });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const setTag = async (tag: string, add: boolean) => {
    try {
      await postVolume(
        `/api/library/volume/${id}/tags`,
        add ? { add: tag } : { remove: tag },
      );
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const refresh = async () => {
    try {
      await post(`/api/library/refresh/${data.volume.id}`);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const markAllRead = async () => {
    const confirmed = await confirm(
      `Mark all ${data.summaries.length} issues as read on ${bulkDate}? This overwrites existing dates.`,
      { title: "Mark all read", confirmLabel: "Mark read" },
    );
    if (!confirmed) return;
    try {
      await post(
        `/api/library/volume/${data.volume.id}/read-all?date=${bulkDate}`,
      );
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const forget = async () => {
    const confirmed = await confirm(
      `Forget ${data.volume.name} and its cached issues?`,
      { title: "Forget volume", confirmLabel: "Forget" },
    );
    if (!confirmed) return;

    const alsoIgnore = await confirm(
      "Also mark it ignored, so Discovery keeps it greyed out as a duplicate you don't want?",
      { title: "Skip in future", confirmLabel: "Ignore it", cancelLabel: "No" },
    );

    const r = await fetch(`/api/library/${data.volume.id}`, {
      method: "DELETE",
    });
    if (!r.ok) return setError(`API ${r.status}`);
    if (alsoIgnore) {
      await fetch(`/api/library/volume/${data.volume.id}/ignore`, {
        method: "POST",
      });
    }
    navigate("/gallery");
  };

  const copyYaml = async () => {
    try {
      const r = await fetch(`/api/volume/${data.volume.id}/export`, {
        method: "GET",
      });
      if (!r.ok) throw new Error(`API ${r.status}`);

      const result = await r.json();
      await navigator.clipboard.writeText(result.yaml);
      setToast({ message: "YAML coppied to clipboard", tone: "ok" });
    } catch (e) {
      setToast({ message: "Failed to copy YAML", tone: "error" });
    }
  };

  const read = data.summaries.filter((s) => s.readAt !== null).length;

  const missingDetails = Math.max(
    0,
    data.summaries.length - data.detailsCached,
  );

  const startDeepFetch = async () => {
    try {
      const r = await fetch(`/api/index/volume/${id}`, { method: "POST" });
      const body = await r.json();

      if (!r.ok) {
        if (body.job) setJob(body.job);
        setToast({
          message: body.error ?? `API ${r.status}`,
          tone: "error",
        });
        return;
      }

      setJob(body);
    } catch (e) {
      setToast({ message: String(e), tone: "error" });
    }
  };

  return (
    <>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 rounded-lg bg-raised px-4 py-2 text-sm shadow-lg ${
            toast.tone === "error" ? "text-rose-400" : "text-accent"
          }`}
        >
          {toast.message}
        </div>
      )}

      <VolumeHero
        volume={data.volume}
        firstReadAt={data.firstReadAt}
        lastReadAt={data.lastReadAt}
        read={read}
        reading={data.reading}
        ignored={data.ignored}
        ongoing={data.ongoing}
        detailsCached={data.detailsCached}
        onToggleIgnored={toggleIgnored}
        onToggleOngoing={toggleOngoing}
        onToggleReading={toggleReading}
        onCopyYaml={copyYaml}
        onRefresh={refresh}
        onForget={forget}
        onMarkAllRead={markAllRead}
        onBulkDate={setBulkDate}
        bulkDate={bulkDate}
        favourite={data.favourite}
        onToggleFavourite={toggleFavourite}
        nextRelease={data.nextRelease}
        nextReleaseOverride={data.nextReleaseOverride}
        onSetNextRelease={setNextRelease}
        onAdvanceNextRelease={advanceNextRelease}
        tags={data.tags}
        onAddTag={(tag) => setTag(tag, true)}
        onRemoveTag={(tag) => setTag(tag, false)}
        missingDetails={missingDetails}
        job={job}
        onDeepFetch={startDeepFetch}
      ></VolumeHero>

      <IssueBrowser
        issues={data.summaries}
        volumeId={data.volume.id}
        bulkDate={bulkDate}
        onBulkDate={setBulkDate}
        onToggleRead={toggleRead}
        onChanged={load}
        onError={setError}
      />

      <CharacterTable characters={data.volume.characters} />
    </>
  );
}
