export const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-body transition-colors hover:border-muted hover:bg-raised";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const formatShortDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const [, month, day] = iso.split("-").map(Number);
  if (!month || !day) return iso;
  return `${day} ${MONTHS[month - 1]}`;
};
