// Launching React UI on the same server as Backend - resulting in one launch.cmd 

import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { send } from "./http.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};
const UI_DIR = resolve("ui/dist");

export const serveUi = (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
) => {
  if (!existsSync(UI_DIR)) {
    send(res, 503, { error: "UI not built — run npm run build:ui" });
    return;
  }

  const requested = decodeURIComponent(pathname);
  const candidate = resolve(UI_DIR, "." + requested);
  const inside = candidate === UI_DIR || candidate.startsWith(UI_DIR + sep);

  let file =
    inside && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : "";

  if (!file && extname(requested) === "") file = join(UI_DIR, "index.html");

  if (!file || !existsSync(file)) {
    send(res, 404, { error: "not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(file).pipe(res);
};