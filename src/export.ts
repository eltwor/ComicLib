export type HistoryCsvRow = {
  month: string;
  volume: string;
  issue: number;
  releaseDate: string;
  readAt: string;
};

export const buildHistoryCsv = (rows: HistoryCsvRow[]): string => {
  const sorted = [...rows].sort(
    (a,b) =>
    a.readAt.localeCompare(b.readAt) ||
    a.volume.localeCompare(b.volume)  ||
    a.issue - b.issue
  )
const escape = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const header = "month,volume,issue,release_date,read_at";
const lines = sorted.map((r) =>
  [r.month, r.volume, r.issue, r.releaseDate, r.readAt].map(escape).join(","),
);
return [header, ...lines].join("\n") + "\n";

};
