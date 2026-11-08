export const ARTIST_ROLES = new Set(["penciller", "penciler", "inker", "colorist", "artist"]);

// "artist, cover" → ["artist", "cover"]
export const rolesOf = (p: any): string[] =>
  (p.role ?? "")
    .split(",")
    .map((r: string) => r.trim())
    .filter(Boolean);

export const isArtistRole = (role: string) => ARTIST_ROLES.has(role);
