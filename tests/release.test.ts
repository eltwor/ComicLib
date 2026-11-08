import { describe, expect, it } from "vitest";
import {
  advanceRelease,
  nextReleaseAfter,
  resolveNextRelease,
} from "../src/release.ts";

describe("nextReleaseAfter", () => {
  it("adds 28 days to the last issue date", () => {
    expect(nextReleaseAfter("2026-10-07", "2026-10-01")).toBe("2026-11-04");
  });

  it("keeps the same weekday instead of snapping to Wednesday", () => {
    // 2026-10-07 is a Wednesday; +28 days is also a Wednesday.
    expect(nextReleaseAfter("2026-10-08", "2026-10-01")).toBe("2026-11-05");
  });

  it("advances in 28-day steps until the date is not in the past", () => {
    expect(nextReleaseAfter("2026-01-01", "2026-03-01")).toBe("2026-03-26");
  });
});

describe("advanceRelease", () => {
  it("moves a released date on by 28 days", () => {
    expect(advanceRelease("2026-10-07", "2026-10-01")).toBe("2026-11-04");
  });

  it("skips past today when the next date has already passed", () => {
    expect(advanceRelease("2026-01-01", "2026-03-01")).toBe("2026-03-26");
  });
});

describe("resolveNextRelease", () => {
  it("prefers a stored override", () => {
    expect(
      resolveNextRelease("2026-10-07", "2026-12-02", "2026-10-01"),
    ).toEqual({ date: "2026-12-02", source: "override" });
  });

  it("derives 28 days from the last issue date", () => {
    expect(resolveNextRelease("2026-10-07", undefined, "2026-10-01")).toEqual({
      date: "2026-11-04",
      source: "derived",
    });
  });

  it("returns none when there is nothing to derive from", () => {
    expect(resolveNextRelease(null, undefined, "2026-10-01")).toEqual({
      date: null,
      source: "none",
    });
  });
});
