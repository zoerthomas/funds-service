import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";

vi.mock("../config", () => ({ config: { dbPath: ":memory:" } }));

import app from "../app";
import { fundDb, upsertFund } from "../fundDb";
import {
  fundSchema,
  fundSummarySchema,
  serverErrorSchema,
  validationErrorSchema,
} from "../schemas";
import { sampleFunds } from "./testHelpers";

let server: Server;
let baseUrl: string;

const get = async (path: string) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { res, body: await res.json() };
};

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  fundDb.exec("DELETE FROM funds");
  for (const fund of sampleFunds()) upsertFund(fund);
});

describe("GET /openapi.json", () => {
  it("serves the generated document", async () => {
    const { res, body } = await get("/openapi.json");

    expect(res.status).toBe(200);
    expect(body.openapi).toBe("3.0.3");
    expect(Object.keys(body.paths)).toEqual(["/funds", "/funds/{code}"]);
    expect(
      body.paths["/funds"].get.parameters.map((p: { name: string }) => p.name),
    ).toEqual([
      "maxOngoingCharge",
      "minAnalystRating",
      "maxRiskRating",
      "sector",
      "sort",
      "order",
    ]);
  });
});

describe("responses match the documented schemas", () => {
  it("GET /funds/:code", async () => {
    const { body } = await get("/funds/AAAAAA1");

    expect(fundSchema.strict().safeParse(body).success).toBe(true);
  });

  it("GET /funds", async () => {
    const { body } = await get("/funds");

    expect(z.array(fundSummarySchema.strict()).safeParse(body).success).toBe(
      true,
    );
  });

  it("400 validation error", async () => {
    const { res, body } = await get("/funds?minAnalystRating=9");

    expect(res.status).toBe(400);
    expect(validationErrorSchema.safeParse(body).success).toBe(true);
  });

  it("500 server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(fundDb, "prepare").mockImplementation(() => {
      throw new Error("db down");
    });

    const { res, body } = await get("/funds");

    expect(res.status).toBe(500);
    expect(serverErrorSchema.safeParse(body).success).toBe(true);
    vi.restoreAllMocks();
  });
});
