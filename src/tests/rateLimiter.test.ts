import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { createRateLimiter } from "../rateLimiter";

let server: Server;

const start = async (limit: number) => {
  const app = express();
  app.use(createRateLimiter({ limit, windowMs: 60_000 }));
  app.get("/", (_req, res) => {
    res.json({ ok: true });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  return `http://localhost:${(server.address() as AddressInfo).port}`;
};

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("createRateLimiter", () => {
  it("allows requests up to the limit then responds 429 with the error shape", async () => {
    const url = await start(2);

    expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url)).status).toBe(200);
    const blocked = await fetch(url);

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "Too many requests" });
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });

  it("advertises the limit on successful responses", async () => {
    const url = await start(5);

    const res = await fetch(url);

    expect(res.headers.get("ratelimit-policy")).toContain("q=5");
    expect(res.headers.get("ratelimit")).toContain("r=4");
  });
});
