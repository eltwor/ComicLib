// ─── release dates — pure date math, no I/O ─────────────────────────────

export const RELEASE_INTERVAL_DAYS = 28;

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Most DC ongoings ship monthly, so the next release is the last one + 28 days.
// Keep advancing in 28-day steps until the date is today or later.
export const nextReleaseAfter = (fromDate: string, today: string): string => {
  let next = addDays(fromDate, RELEASE_INTERVAL_DAYS);
  let guard = 0;

  while (next < today && guard < 1000) {
    next = addDays(next, RELEASE_INTERVAL_DAYS);
    guard += 1;
  }

  return next;
};

export const advanceRelease = (date: string, today: string): string =>
  nextReleaseAfter(date, today);

export type NextReleaseSource = "override" | "derived" | "none";

export type NextRelease = {
  date: string | null;
  source: NextReleaseSource;
};

export const resolveNextRelease = (
  lastIssueDate: string | null,
  override: string | undefined,
  today: string,
): NextRelease => {
  if (override) return { date: override, source: "override" };
  if (!lastIssueDate) return { date: null, source: "none" };
  return { date: nextReleaseAfter(lastIssueDate, today), source: "derived" };
};
