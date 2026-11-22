import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler, notFoundHandler } from "../errorHandler";

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  app.get("/zod", () => {
    z.object({ n: z.number() }).parse({ n: "nope" });
  });
  app.get("/boom", () => {
    throw new Error("SQLITE_ERROR: no such column secret_column");
  });
  app.post("/json", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("errorHandler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/nope`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("returns 400 with field details for validation errors", async () => {
    const res = await fetch(`${baseUrl}/zod`);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid request");
    expect(body.details.fieldErrors).toHaveProperty("n");
  });

  it("returns 400 for a malformed JSON body", async () => {
    const res = await fetch(`${baseUrl}/json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Bad request" });
  });

  it("hides internal errors on 500 but logs them with a matching request id", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await fetch(`${baseUrl}/boom`);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toMatch(/SQLITE|secret_column/);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain(body.requestId);
    expect(log.mock.calls[0][1]).toBeInstanceOf(Error);
  });
});
