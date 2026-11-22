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

vi.mock("../config", () => ({ config: { dbPath: ":memory:" } }));

import app from "../app";
import { fundDb, upsertFund } from "../fundDb";
import { sampleFunds } from "./testHelpers";

let server: Server;
let baseUrl: string;

const get = async (path: string) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { res, body: await res.json() };
};

const listCodes = async (query: string) => {
  const { res, body } = await get(`/funds${query}`);
  expect(res.status).toBe(200);
  return (body as Array<{ code: string }>).map((f) => f.code);
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

describe("GET /funds/:code", () => {
  it("returns the full fund", async () => {
    const expected = sampleFunds()[0];

    const { res, body } = await get("/funds/AAAAAA1");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(body).toEqual(expected);
  });

  it("returns 404 for a well-formed code that doesn't exist", async () => {
    const { res, body } = await get("/funds/ZZZZZZ9");

    expect(res.status).toBe(404);
    expect(body.error).toContain("ZZZZZZ9");
  });

  it.each(["ABC", "TOOLONGCODE", "AAAAA!1"])(
    "returns 400 for the malformed code %j",
    async (code) => {
      const { res, body } = await get(`/funds/${encodeURIComponent(code)}`);

      expect(res.status).toBe(400);
      expect(body.error).toBe("Invalid request");
    },
  );
});

describe("GET /funds", () => {
  it("returns every fund as a summary, sorted by name", async () => {
    const { res, body } = await get("/funds");

    expect(res.status).toBe(200);
    expect(body.map((f: { code: string }) => f.code)).toEqual([
      "AAAAAA1",
      "BBBBBB2",
      "CCCCCC3",
      "DDDDDD4",
    ]);
    expect(body[0]).toEqual({
      code: "AAAAAA1",
      name: "Alpha",
      price: { amount: 150, currency: "GBX" },
      priceDate: "2024-06-04",
      ongoingChargePercent: 0.1,
      sector: "Flexible Investment",
      analystRating: 5,
      analystRatingLabel: "Neutral",
      riskRating: 2,
      lastUpdated: "2024-06-05T06:00:00.000Z",
    });
  });

  it("returns an empty array when nothing matches", async () => {
    expect(await listCodes("?sector=SevenG")).toEqual([]);
  });

  describe("filters", () => {
    it("coerces numeric filters from the query string", async () => {
      expect(
        await listCodes("?maxOngoingCharge=0.3&minAnalystRating=4"),
      ).toEqual(["AAAAAA1", "CCCCCC3"]);
    });

    it("treats maxOngoingCharge=0 as a real filter", async () => {
      expect(await listCodes("?maxOngoingCharge=0")).toEqual(["DDDDDD4"]);
    });

    it("filters by maxRiskRating", async () => {
      expect(await listCodes("?maxRiskRating=4")).toEqual([
        "AAAAAA1",
        "CCCCCC3",
      ]);
    });

    it("filters by a URL-encoded sector containing a percent sign", async () => {
      const query = new URLSearchParams({
        sector: "Mixed Investment 0-35% Shares",
      });

      expect(await listCodes(`?${query}`)).toEqual(["CCCCCC3", "DDDDDD4"]);
    });
  });

  describe("sorting", () => {
    it("sorts by price descending", async () => {
      expect(await listCodes("?sort=price&order=desc")).toEqual([
        "AAAAAA1",
        "CCCCCC3",
        "BBBBBB2",
        "DDDDDD4",
      ]);
    });

    it("sorts by analyst rating with unrated funds last", async () => {
      expect(await listCodes("?sort=analystRating&order=desc")).toEqual([
        "AAAAAA1",
        "CCCCCC3",
        "BBBBBB2",
        "DDDDDD4",
      ]);
    });
  });

  describe("validation", () => {
    it.each([
      "?minAnalystRating=9",
      "?minAnalystRating=0",
      "?minAnalystRating=2.5",
      "?maxRiskRating=8",
      "?maxOngoingCharge=-1",
      "?maxOngoingCharge=abc",
      "?sort=banana",
      "?order=sideways",
      "?sector=",
      "?sector=a&sector=b",
    ])("returns 400 for %s", async (query) => {
      const { res, body } = await get(`/funds${query}`);

      expect(res.status).toBe(400);
      expect(body.error).toBe("Invalid request");
      expect(body.details).toBeDefined();
    });
  });
});

describe("app", () => {
  it("returns a JSON 404 for unknown routes", async () => {
    const { res, body } = await get("/nope");

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
  });

  it("returns 404 for nested paths under a fund", async () => {
    const { res } = await get("/funds/AAAAAA1/extra");

    expect(res.status).toBe(404);
  });

  it("is read-only: other methods are not routed", async () => {
    const res = await fetch(`${baseUrl}/funds`, { method: "POST" });

    expect(res.status).toBe(404);
  });

  it("does not advertise Express", async () => {
    const { res } = await get("/funds");

    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});

describe("GET /funds/:code with a corrupted stored row", () => {
  it.each([
    ["the JSON shape is wrong", JSON.stringify([{ assetClass: "Stock" }])],
    ["the JSON is unparseable", "{not json"],
  ])("responds 500 with a request id when %s", async (_label, badValue) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fundDb
      .prepare("UPDATE funds SET asset_allocation = ? WHERE code = 'AAAAAA1'")
      .run(badValue);

    const { res, body } = await get("/funds/AAAAAA1");

    expect(res.status).toBe(500);
    expect(body).toEqual({
      error: "Internal server error",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
