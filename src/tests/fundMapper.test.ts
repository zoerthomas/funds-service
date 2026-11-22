import { describe, it, expect } from "vitest";
import fixture from "./__fixtures__/growth-cautious.json";
import { parseFundResponse, toGbx } from "../fundMapper";

const CODE = "BYW8RV9";
const FETCHED_AT = new Date("2024-06-05T06:00:00.000Z").toISOString();

const rawFund = () => structuredClone(fixture) as any;

describe("parseFundResponse", () => {
  it("maps the core fund fields", () => {
    const fund = parseFundResponse(rawFund(), CODE, FETCHED_AT);

    expect(fund).toMatchObject({
      code: "BYW8RV9",
      name: "VT AJ Bell Cautious I Acc",
      priceDate: "2024-06-04",
      ongoingChargePercent: 0.31,
      sector: "Mixed Investment 0-35% Shares",
      analystRating: 4,
      analystRatingLabel: "Neutral",
      riskRating: 4,
      lastUpdated: "2024-06-05T06:00:00.000Z",
    });
    expect(fund.objective).toMatch(/^The investment objective/);
  });

  describe("price normalisation", () => {
    it("converts GBP to GBX(pence)", () => {
      const fund = parseFundResponse(rawFund(), CODE, FETCHED_AT);

      expect(fund.price).toEqual({ amount: 118.561, currency: "GBX" });
    });

    it("leaves GBX prices unchanged", () => {
      const raw = rawFund();
      raw.data.quote.currency = "GBX";
      raw.data.quote.lastPrice = 1.2;

      const fund = parseFundResponse(raw, CODE, FETCHED_AT);

      expect(fund.price).toEqual({ amount: 1.2, currency: "GBX" });
    });

    it("rejects unsupported currencies", () => {
      const raw = rawFund();
      raw.data.quote.currency = "USD";

      expect(() => parseFundResponse(raw, CODE, FETCHED_AT)).toThrow();
    });
  });

  it("maps asset allocation with clear names", () => {
    const fund = parseFundResponse(rawFund(), CODE, FETCHED_AT);

    expect(fund.assetAllocation).toHaveLength(5);
    expect(fund.assetAllocation[0]).toEqual({
      assetClass: "Stock",
      allocationPercent: 25.53738,
    });
  });

  it("maps top holdings", () => {
    const fund = parseFundResponse(rawFund(), CODE, FETCHED_AT);

    expect(fund.topHoldings).toHaveLength(10);
    expect(fund.topHoldings[0]).toEqual({
      name: fixture.data.portfolio.top10Holdings[0].name,
      weightingPercent: 16.0041,
    });
  });

  it("maps documents", () => {
    const fund = parseFundResponse(rawFund(), CODE, FETCHED_AT);

    expect(fund.documents.map((d) => d.type)).toEqual([
      "Factsheet",
      "KIID",
      "Prospectus",
    ]);
    expect(fund.documents[0]).toHaveProperty("url");
  });

  it("handles a fund with no analyst rating", () => {
    const raw = rawFund();
    raw.data.ratings.analystRating = null;
    raw.data.ratings.analystRatingLabel = null;

    const fund = parseFundResponse(raw, CODE, FETCHED_AT);

    expect(fund.analystRating).toBeNull();
    expect(fund.analystRatingLabel).toBeNull();
  });

  it("rejects a response missing required fields", () => {
    const raw = rawFund();
    delete raw.data.quote.lastPrice;

    expect(() => parseFundResponse(raw, CODE, FETCHED_AT)).toThrow();
  });

  it("rejects a completely malformed response", () => {
    expect(() => parseFundResponse({ nope: true }, CODE, FETCHED_AT)).toThrow();
  });
});
describe("toGbx", () => {
  it("converts GBP to pence (GBX)", () => {
    expect(toGbx(118.561, "GBP")).toBe(11856.1);
    expect(toGbx(100, "GBP")).toBe(10000);
    expect(toGbx(0, "GBP")).toBe(0);
  });

  it("leaves GBX unchanged", () => {
    expect(toGbx(1.20138, "GBX")).toBe(1.20138);
    expect(toGbx(0, "GBX")).toBe(0);
  });

  it("throws on unsupported currencies", () => {
    expect(() => toGbx(1, "USD")).toThrow("Unsupported currency: USD");
    expect(() => toGbx(1, "")).toThrow();
  });
});
