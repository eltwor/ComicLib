import { describe, expect, it } from "vitest";
import { ARTIST_ROLES, isArtistRole, rolesOf } from "../src/credits.ts";


describe("rolesOf", () => {
  it("splits a comma-joined role string", () => {
    expect(rolesOf({ role: "artist, cover" })).toEqual(["artist", "cover"]);
  });

  it("trims whitespace around each token", () => {
    expect(rolesOf({role: " writer, inker"})).toEqual(["writer", "inker"])
  });

  it("drops empty tokens from trailing or doubled commas", () => {
    expect(rolesOf({role: "writer, ,"})).toEqual(["writer"]);
  });

  it("returns an empty array when role is missing", () => {
    expect(rolesOf({})).toEqual([]);
    expect(rolesOf({role: undefined})).toEqual([]);
  });
});

describe("isArtistRole", () => {
  it("does not treat cover as an artist role", () => {
    expect(isArtistRole('cover')).toEqual(false);    
  });

  it("accepts every token in ARTIST_ROLES", () => {
    for (const role of ARTIST_ROLES) {
      expect(isArtistRole(role)).toBe(true);
    }
  });

  it("rejects non-artist roles", () => {
    expect(isArtistRole('writer')).toEqual(false);
    expect(isArtistRole('editor')).toEqual(false);
  });
});
