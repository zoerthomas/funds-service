import Decimal from "decimal.js";
import { z } from "zod";
import { Fund } from "./types";

const rawFundSchema = z.object({
  data: z.object({
    quote: z.object({
      name: z.string(),
      marketCode: z.string(),
      lastPrice: z.number(),
      lastPriceDate: z.string(),
      ongoingCharge: z.number(),
      sectorName: z.string(),
      currency: z.enum(["GBX", "GBP"]),
    }),
    profile: z.object({ objective: z.string() }),
    ratings: z.object({
      analystRating: z.number().nullable().optional(),
      SRRI: z.number().nullable().optional(),
      analystRatingLabel: z.string().nullable().optional(),
    }),
    documents: z.array(
      z.object({ id: z.string(), type: z.string(), url: z.string() }),
    ),
    portfolio: z.object({
      asset: z.array(z.object({ label: z.string(), value: z.number() })),
      top10Holdings: z.array(
        z.object({ name: z.string(), weighting: z.number() }),
      ),
    }),
  }),
});

export const toGbx = (amount: number, currency: string): number => {
  if (currency === "GBX") return amount;
  if (currency === "GBP") return new Decimal(amount).times(100).toNumber();
  throw new Error(`Unsupported currency: ${currency}`);
};

export const parseFundResponse = (
  rawFund: unknown,
  code: string,
  fetchedAt: string,
): Fund => {
  const fund = rawFundSchema.parse(rawFund);
  const quote = fund.data.quote;
  const ratings = fund.data.ratings;
  const documents = fund.data.documents;
  const assets = fund.data.portfolio.asset;
  const holdings = fund.data.portfolio.top10Holdings;
  return {
    code,
    name: quote.name,
    price: {
      amount: toGbx(quote.lastPrice, quote.currency),
      currency: "GBX",
    },
    priceDate: quote.lastPriceDate,
    ongoingChargePercent: quote.ongoingCharge,
    sector: quote.sectorName,
    analystRating: ratings.analystRating ?? null,
    analystRatingLabel: ratings.analystRatingLabel ?? null,
    riskRating: ratings.SRRI ?? null,
    objective: fund.data.profile.objective,
    documents: documents.map((document) => ({
      id: document.id,
      type: document.type,
      url: document.url,
    })),
    assetAllocation: assets.map((asset) => ({
      assetClass: asset.label,
      allocationPercent: asset.value,
    })),
    topHoldings: holdings.map((holding) => ({
      name: holding.name,
      weightingPercent: holding.weighting,
    })),
    lastUpdated: fetchedAt,
  };
};
