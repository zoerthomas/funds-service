import type { Fund } from "../types";

export const makeFund = (
  code: string,
  overrides: Partial<Fund> = {},
): Fund => ({
  code,
  name: `Fund ${code}`,
  price: { amount: 100, currency: "GBX" },
  priceDate: "2024-06-04",
  ongoingChargePercent: 0.3,
  sector: "Flexible Investment",
  analystRating: 3,
  analystRatingLabel: "Neutral",
  riskRating: 4,
  objective: "The investment objective of the fund is long-term growth.",
  documents: [{ id: "1", type: "KIID", url: "https://example.test/kiid.pdf" }],
  assetAllocation: [{ assetClass: "Stock", allocationPercent: 60 }],
  topHoldings: [{ name: "Holding", weightingPercent: 10 }],
  lastUpdated: "2024-06-05T06:00:00.000Z",
  ...overrides,
});

export const sampleFunds = (): Fund[] => [
  makeFund("AAAAAA1", {
    name: "Alpha",
    price: { amount: 150, currency: "GBX" },
    ongoingChargePercent: 0.1,
    analystRating: 5,
    riskRating: 2,
    sector: "Flexible Investment",
  }),
  makeFund("BBBBBB2", {
    name: "Bravo",
    price: { amount: 100, currency: "GBX" },
    ongoingChargePercent: 0.5,
    analystRating: 3,
    riskRating: 6,
    sector: "Flexible Investment",
  }),
  makeFund("CCCCCC3", {
    name: "Charlie",
    price: { amount: 120, currency: "GBX" },
    ongoingChargePercent: 0.3,
    analystRating: 4,
    riskRating: 4,
    sector: "Mixed Investment 0-35% Shares",
  }),
  makeFund("DDDDDD4", {
    name: "Delta",
    price: { amount: 90, currency: "GBX" },
    ongoingChargePercent: 0,
    analystRating: null,
    analystRatingLabel: null,
    riskRating: null,
    sector: "Mixed Investment 0-35% Shares",
  }),
];
