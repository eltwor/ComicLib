import {
  fillIssueDetails,
  getVolume,
  listCachedIssueIds,
  listCachedSummaries,
} from "./comicvine.ts";
import { readLibrary } from "./library.ts";

type IndexJob = {
  kind: "read" | "volume" | null;
  volumeId: number | null;
  volumeName: string;
  running: boolean;
  done: number;
  total: number;
  fresh: number;
  error: string | null;
};

let indexJob: IndexJob = {
  running: false,
  kind: null,
  volumeId: null,
  volumeName: "",
  done: 0,
  total: 0,
  fresh: 0,
  error: null,
};

export const getIndexJob = (): IndexJob => indexJob;

// Mass caching read issues from Creator Page
export const startReadIndexJob = async (): Promise<IndexJob> => {
  if (indexJob.running) return indexJob;

  indexJob = {
    running: true,
    done: 0,
    total: 0,
    fresh: 0,
    error: null,
    kind: "read",
    volumeId: null,
    volumeName: "",
  };

  try {
    const [summaries, detailIds] = await Promise.all([
      listCachedSummaries(),
      listCachedIssueIds(),
    ]);
    const readIds = new Set(Object.keys(readLibrary().issues).map(Number));
    const todo = summaries.filter(
      (s) => readIds.has(s.id) && !detailIds.has(s.id),
    );

    indexJob = { ...indexJob, total: todo.length };

    void (async () => {
      try {
        await fillIssueDetails(todo, (done, total, fresh) => {
          indexJob = { ...indexJob, done, total, fresh };
        });
      } catch (e) {
        indexJob = { ...indexJob, error: String(e) };
      } finally {
        indexJob = { ...indexJob, running: false };
      }
    })();
  } catch (e) {
    indexJob = { ...indexJob, running: false, error: String(e) };
  }

  return indexJob;
};

export const startVolumeIndexJob = async (
  volumeId: number,
): Promise<{ started: boolean; busy: boolean; job: IndexJob }> => {
  if (indexJob.running) return { started: false, busy: true, job: indexJob };

  try {
    const { volume, summaries } = await getVolume(volumeId);
    const detailIds = await listCachedIssueIds();
    const todo = summaries.filter((s) => !detailIds.has(s.id));

    indexJob = {
      running: true,
      done: 0,
      total: todo.length,
      fresh: 0,
      error: null,
      kind: "volume",
      volumeId: volumeId,
      volumeName: volume.name,
    };

    void (async () => {
      try {
        await fillIssueDetails(todo, (done, total, fresh) => {
          indexJob = { ...indexJob, done, total, fresh };
        });
      } catch (e) {
        indexJob = {
          ...indexJob,
          running: false,
          kind: "volume",
          volumeId,
          error: String(e),
        };
      } finally {
        indexJob = { ...indexJob, running: false };
      }
    })();
  } catch (e) {
    indexJob = {
      ...indexJob,
      running: false,
      kind: "volume",
      volumeId,
      volumeName: "",
      error: String(e),
    };
    return { started: false, busy: false, job: indexJob };
  }

  return { started: true, busy: false, job: indexJob };
};
