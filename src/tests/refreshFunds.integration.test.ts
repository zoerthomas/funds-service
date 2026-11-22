import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  config: {
    dbPath: ":memory:",
    fundSourceUrl: "https://example.test/{code}.json",
    fundCodes: [] as string[],
    fetchTimeoutMs: 10_000,
  },
}));

import { config } from "../config";
import { refreshFunds } from "../fetchFundData";
import { fundDb, getFund, listFunds } from "../fundDb";

const FUNDS = [
  {
    file: "growth-cautious.json",
    code: "BYW8RV9",
    name: "VT AJ Bell Cautious I Acc",
  },
  {
    file: "growth-balanced.json",
    code: "BYW8RX1",
    name: "VT AJ Bell Balanced I Acc",
  },
  {
    file: "growth-adventurous.json",
    code: "BYW8VG2",
    name: "VT AJ Bell Adventurous I Acc",
  },
  {
    file: "responsible-growth.json",
    code: "BN0S2V9",
    name: "VT AJ Bell Responsible Gr I GBP Acc",
  },
];

const loadFixture = (file: string) =>
  JSON.parse(readFileSync(join(__dirname, "__fixtures__", file), "utf8"));

let upstream: Map<string, () => Response>;

const serveFixtures = () => {
  upstream = new Map(
    FUNDS.map(({ file, code }) => [
      code,
      () => Response.json(loadFixture(file)),
    ]),
  );
};

beforeEach(() => {
  fundDb.exec("DELETE FROM funds");
  config.fundCodes = FUNDS.map((f) => f.code);
  serveFixtures();
  vi.stubGlobal("fetch", async (url: string) => {
    const code = url.split("/").pop()!.replace(".json", "");
    return upstream.get(code)?.() ?? new Response("not found", { status: 404 });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("refreshFunds against a real database", () => {
  it("fetches and stores every fund", async () => {
    await refreshFunds();

    expect(listFunds()).toHaveLength(4);
    for (const { code, name } of FUNDS) {
      expect(getFund(code)?.name).toBe(name);
    }
  });

  it("stores the GBP-priced fund in pence alongside the GBX ones", async () => {
    await refreshFunds();

    expect(getFund("BN0S2V9")?.price.amount).toBe(120.138);
    expect(getFund("BYW8RV9")?.price.amount).toBe(118.561);
  });

  it("updates changed values on a later refresh without duplicating", async () => {
    await refreshFunds();
    const changed = loadFixture("growth-cautious.json");
    changed.data.quote.lastPrice = 999;
    upstream.set("BYW8RV9", () => Response.json(changed));

    await refreshFunds();

    expect(getFund("BYW8RV9")?.price.amount).toBe(999);
    expect(listFunds()).toHaveLength(4);
  });

  it("keeps the stored fund when upstream later returns a bad payload", async () => {
    await refreshFunds();
    const before = getFund("BYW8RV9");
    upstream.set("BYW8RV9", () =>
      Response.json({ data: { quote: { name: "mangled" } } }),
    );

    await refreshFunds();

    expect(getFund("BYW8RV9")?.name).toBe(before?.name);
    expect(getFund("BYW8RV9")?.price).toEqual(before?.price);
  });

  it("keeps the stored fund when upstream is down, and still updates the others", async () => {
    await refreshFunds();
    const downBefore = getFund("BYW8RX1");
    const changed = loadFixture("growth-cautious.json");
    changed.data.quote.lastPrice = 500;
    upstream.set("BYW8RV9", () => Response.json(changed));
    upstream.set("BYW8RX1", () => new Response("boom", { status: 503 }));

    await refreshFunds();

    expect(getFund("BYW8RX1")).toEqual(downBefore);
    expect(getFund("BYW8RV9")?.price.amount).toBe(500);
  });

  it("stores nothing for a fund that has never loaded successfully", async () => {
    upstream.set("BYW8VG2", () => new Response("boom", { status: 500 }));

    await refreshFunds();

    expect(getFund("BYW8VG2")).toBeUndefined();
    expect(listFunds()).toHaveLength(3);
  });
});
