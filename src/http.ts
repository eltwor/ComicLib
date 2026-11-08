import type { ServerResponse } from "node:http";

const h = { "Content-Type": "application/json" };

export const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, h);
  res.end(JSON.stringify(body));
};
