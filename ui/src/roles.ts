export type RoleFilter = "all" | "writer" | "artist" | "cover";

export const ARTIST_ROLES = new Set([
  "penciller",
  "inker",
  "colorist",
  "artist",
]);

export const CREATIVE_ROLES = new Set([
  "writer",
  "penciller",
  "inker",
  "colorist",
  "artist",
  "cover",
]);

export const isCreative = (roles: string[]) =>
  roles.some((role) => CREATIVE_ROLES.has(role));

export type RoleLetter = {
  key: string;
  label: string;
  group: RoleFilter | "other";
  title: string;
};

export const roleLetters = (roles: string[]): RoleLetter[] => {
  const letters: RoleLetter[] = [];

  if (roles.includes("writer")) {
    letters.push({ key: "W", label: "W", group: "writer", title: "Writer" });
  }
  if (roles.some((role) => ARTIST_ROLES.has(role))) {
    letters.push({
      key: "A",
      label: "A",
      group: "artist",
      title: "Artist (penciler, inker, colorist)",
    });
  }
  if (roles.includes("cover")) {
    letters.push({ key: "C", label: "C", group: "cover", title: "Cover" });
  }
  if (roles.some((role) => !CREATIVE_ROLES.has(role))) {
    letters.push({
      key: "O",
      label: "O",
      group: "other",
      title: "Other (editor, letterer, production)",
    });
  }

  return letters;
};
