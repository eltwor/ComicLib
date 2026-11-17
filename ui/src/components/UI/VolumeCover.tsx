export function VolumeCover({
  src,
  name,
  size = "md",
}: {
  src: string;
  name: string;
  size?: "sm" | "md";
}) {
  const dimensions =
    size === "sm" ? "h-[60px] w-[39px]" : "h-[66px] w-[44px]";
  const initialsText = size === "sm" ? "text-[8px]" : "text-[9px]";

  if (src) {
    return (
      <img
        src={src}
        alt={`${name} cover`}
        className={`${dimensions} shrink-0 rounded object-cover shadow-[0_4px_12px_rgba(0,0,0,0.35)]`}
      />
    );
  }

  const words = name
    .replace(/[^A-Za-z ]/g, " ")
    .split(/\s+/)
    .filter(
      (word) => word && !["of", "the", "and"].includes(word.toLowerCase()),
    );
  const initials =
    words.length > 1
      ? words
          .slice(0, 3)
          .map((word) => word[0])
          .join("")
      : (words[0] ?? "").slice(0, 3);

  return (
    <div
      aria-hidden="true"
      className={`flex ${dimensions} shrink-0 items-end rounded bg-gradient-to-br from-accent/50 to-base p-1 ${initialsText} font-extrabold leading-none tracking-wide text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)]`}
    >
      {initials.toUpperCase()}
    </div>
  );
}
