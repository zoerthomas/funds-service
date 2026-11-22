import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({ config: { dbPath: ":memory:" } }));

import { fundDb, getFund, listFunds, upsertFund } from "../fundDb";
import { parseFundResponse } from "../fundMapper";
import { makeFund, sampleFunds } from "./testHelpers";
import type { FundFilters } from "../types";

const codes = (filters?: FundFilters) => listFunds(filters).map((f) => f.code);

beforeEach(() => {
  fundDb.exec("DELETE FROM funds");
});

describe("upsertFund / getFund", () => {
  it("stores a fund and reads back an identical one", () => {
    const fund = makeFund("AAAAAA1");

    upsertFund(fund);

    expect(getFund("AAAAAA1")).toEqual(fund);
  });

  it("round-trips null ratings as null", () => {
    const fund = makeFund("AAAAAA1", {
      analystRating: null,
      analystRatingLabel: null,
      riskRating: null,
    });

    upsertFund(fund);

    expect(getFund("AAAAAA1")).toEqual(fund);
  });

  it("round-trips every example response", () => {
    const files: Array<[string, string]> = [
      ["growth-cautious.json", "BYW8RV9"],
      ["growth-balanced.json", "BYW8RX1"],
      ["growth-adventurous.json", "BYW8VG2"],
      ["responsible-growth.json", "BN0S2V9"],
    ];

    for (const [file, code] of files) {
      const raw = JSON.parse(
        readFileSync(join(__dirname, "__fixtures__", file), "utf8"),
      );
      const fund = parseFundResponse(raw, code, "2024-06-05T06:00:00.000Z");

      upsertFund(fund);

      expect(getFund(code), file).toEqual(fund);
    }
  });

  it("updates an existing fund in place instead of duplicating it", () => {
    upsertFund(
      makeFund("AAAAAA1", {
        name: "Old name",
        price: { amount: 100, currency: "GBX" },
      }),
    );

    upsertFund(
      makeFund("AAAAAA1", {
        name: "New name",
        price: { amount: 125, currency: "GBX" },
      }),
    );

    expect(getFund("AAAAAA1")).toMatchObject({
      name: "New name",
      price: { amount: 125 },
    });
    expect(listFunds()).toHaveLength(1);
  });

  it("clears a rating that becomes null on update", () => {
    upsertFund(makeFund("AAAAAA1", { riskRating: 5 }));

    upsertFund(makeFund("AAAAAA1", { riskRating: null }));

    expect(getFund("AAAAAA1")?.riskRating).toBeNull();
  });

  it("returns undefined for an unknown code", () => {
    expect(getFund("ZZZZZZ9")).toBeUndefined();
  });
});

describe("listFunds", () => {
  beforeEach(() => {
    for (const fund of sampleFunds()) upsertFund(fund);
  });

  it("returns every fund sorted by name by default", () => {
    expect(codes()).toEqual(["AAAAAA1", "BBBBBB2", "CCCCCC3", "DDDDDD4"]);
  });

  it("returns summaries, not full funds", () => {
    const [first] = listFunds();

    expect(Object.keys(first).sort()).toEqual(
      [
        "analystRating",
        "analystRatingLabel",
        "code",
        "lastUpdated",
        "name",
        "ongoingChargePercent",
        "price",
        "priceDate",
        "riskRating",
        "sector",
      ].sort(),
    );
    expect(first.price).toEqual({ amount: 150, currency: "GBX" });
  });

  it("returns an empty list when nothing matches", () => {
    expect(listFunds({ maxOngoingCharge: -1 })).toEqual([]);
  });

  describe("filters", () => {
    it("maxOngoingCharge is inclusive", () => {
      expect(codes({ maxOngoingCharge: 0.3 })).toEqual([
        "AAAAAA1",
        "CCCCCC3",
        "DDDDDD4",
      ]);
    });

    it("maxOngoingCharge of 0 is a real filter, not ignored", () => {
      expect(codes({ maxOngoingCharge: 0 })).toEqual(["DDDDDD4"]);
    });

    it("minAnalystRating is inclusive and excludes unrated funds", () => {
      expect(codes({ minAnalystRating: 4 })).toEqual(["AAAAAA1", "CCCCCC3"]);
    });

    it("maxRiskRating is inclusive and excludes unrated funds", () => {
      expect(codes({ maxRiskRating: 4 })).toEqual(["AAAAAA1", "CCCCCC3"]);
    });

    it("sector is an exact match", () => {
      expect(codes({ sector: "Mixed Investment 0-35% Shares" })).toEqual([
        "CCCCCC3",
        "DDDDDD4",
      ]);
      expect(codes({ sector: "mixed investment 0-35% shares" })).toEqual([]);
    });

    it("combines filters with AND", () => {
      expect(
        codes({ sector: "Flexible Investment", minAnalystRating: 4 }),
      ).toEqual(["AAAAAA1"]);
      expect(
        codes({ maxOngoingCharge: 0.3, minAnalystRating: 4, maxRiskRating: 3 }),
      ).toEqual(["AAAAAA1"]);
    });

    it("treats a hostile sector value as data", () => {
      expect(codes({ sector: "x' OR '1'='1" })).toEqual([]);
      expect(listFunds()).toHaveLength(4);
    });
  });

  describe("sorting", () => {
    it("sorts by price", () => {
      expect(codes({ sort: "price", order: "asc" })).toEqual([
        "DDDDDD4",
        "BBBBBB2",
        "CCCCCC3",
        "AAAAAA1",
      ]);
      expect(codes({ sort: "price", order: "desc" })).toEqual([
        "AAAAAA1",
        "CCCCCC3",
        "BBBBBB2",
        "DDDDDD4",
      ]);
    });

    it("sorts by ongoing charge", () => {
      expect(codes({ sort: "ongoingChargePercent", order: "asc" })).toEqual([
        "DDDDDD4",
        "AAAAAA1",
        "CCCCCC3",
        "BBBBBB2",
      ]);
    });

    it("sorts by name descending", () => {
      expect(codes({ sort: "name", order: "desc" })).toEqual([
        "DDDDDD4",
        "CCCCCC3",
        "BBBBBB2",
        "AAAAAA1",
      ]);
    });

    it("puts unrated funds last in both directions", () => {
      expect(codes({ sort: "analystRating", order: "asc" })).toEqual([
        "BBBBBB2",
        "CCCCCC3",
        "AAAAAA1",
        "DDDDDD4",
      ]);
      expect(codes({ sort: "analystRating", order: "desc" })).toEqual([
        "AAAAAA1",
        "CCCCCC3",
        "BBBBBB2",
        "DDDDDD4",
      ]);
      expect(codes({ sort: "riskRating", order: "asc" })).toEqual([
        "AAAAAA1",
        "CCCCCC3",
        "BBBBBB2",
        "DDDDDD4",
      ]);
    });

    it("breaks ties by code so ordering is stable", () => {
      fundDb.exec("DELETE FROM funds");
      upsertFund(makeFund("ZZZZZZ9", { ongoingChargePercent: 0.9 }));
      upsertFund(makeFund("AAAAAA1", { ongoingChargePercent: 0.9 }));
      upsertFund(makeFund("MMMMMM5", { ongoingChargePercent: 0.9 }));

      expect(codes({ sort: "ongoingChargePercent" })).toEqual([
        "AAAAAA1",
        "MMMMMM5",
        "ZZZZZZ9",
      ]);
    });

    it.each(["banana", "constructor", "__proto__", "name; DROP TABLE funds"])(
      "rejects the unknown sort field %j without touching the table",
      (sort) => {
        expect(() => listFunds({ sort: sort as never })).toThrow();
        expect(listFunds()).toHaveLength(4);
      },
    );
  });
});
