import { describe, expect, it } from "vitest";
import { isValidSession, readCookie, signSession } from "../src/session.ts";

const SECRET = "hunter2";
const NOW = 1_700_000_000_000;

describe("signSession", () => {
  it("joins the expiry and its signature with a dot", () => {
    const token = signSession(SECRET, NOW + 60_000);
    const parts = token.split(".");

    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(String(NOW + 60_000));
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("is deterministic for the same secret and expiry", () => {
    expect(signSession(SECRET, NOW)).toBe(signSession(SECRET, NOW));
  });

  it("changes when the secret changes", () => {
    expect(signSession(SECRET, NOW)).not.toBe(signSession("other", NOW));
  });
});

describe("isValidSession", () => {
  it("accepts a token it signed before it expires", () => {
    const token = signSession(SECRET, NOW + 60_000);
    expect(isValidSession(token, SECRET, NOW)).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession("someone-else", NOW + 60_000);
    expect(isValidSession(token, SECRET, NOW)).toBe(false);
  });

  it("rejects a token whose expiry was edited", () => {
    const token = signSession(SECRET, NOW + 60_000);
    const [, sig] = token.split(".");
    expect(isValidSession(`${NOW + 9_999_999}.${sig}`, SECRET, NOW)).toBe(
      false,
    );
  });

  it("rejects a token whose signature was edited", () => {
    const token = signSession(SECRET, NOW + 60_000);
    const [exp] = token.split(".");
    expect(isValidSession(`${exp}.forged`, SECRET, NOW)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signSession(SECRET, NOW - 1);
    expect(isValidSession(token, SECRET, NOW)).toBe(false);
  });

  it("rejects missing or malformed tokens", () => {
    expect(isValidSession(undefined, SECRET, NOW)).toBe(false);
    expect(isValidSession("", SECRET, NOW)).toBe(false);
    expect(isValidSession("no-dot-here", SECRET, NOW)).toBe(false);
    expect(isValidSession(`${NOW + 1000}.`, SECRET, NOW)).toBe(false);
    expect(isValidSession("not-a-number.abc", SECRET, NOW)).toBe(false);
  });
});

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    expect(
      readCookie("theme=dark; comiclib_session=abc.def; other=1", "comiclib_session"),
    ).toBe("abc.def");
  });

  it("trims surrounding whitespace", () => {
    expect(readCookie("  a=1;  b=2 ", "b")).toBe("2");
  });

  it("returns undefined when the cookie or header is absent", () => {
    expect(readCookie("a=1; b=2", "c")).toBeUndefined();
    expect(readCookie(undefined, "a")).toBeUndefined();
  });

  it("keeps everything after the first equals sign", () => {
    expect(readCookie("token=a=b=c", "token")).toBe("a=b=c");
  });
});
