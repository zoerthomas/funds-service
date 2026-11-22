import { z } from "zod";

export const fundCodeSchema = z
  .string()
  .toUpperCase()
  .regex(/^[A-Z0-9]{7}$/)
  .meta({
    description: "7-character alphanumeric fund code (case-insensitive).",
    example: "BYW8RV9",
  });

export const moneySchema = z.object({
  amount: z.number().meta({ description: "Price in pence.", example: 118.561 }),
  currency: z.literal("GBX"),
});

export const fundDocumentSchema = z.object({
  id: z.string(),
  type: z
    .string()
    .meta({ description: "For example Factsheet, KIID or Prospectus." }),
  url: z.string(),
});

export const assetAllocationSchema = z.object({
  assetClass: z.string().meta({ example: "Stock" }),
  allocationPercent: z.number(),
});

export const holdingSchema = z.object({
  name: z.string(),
  weightingPercent: z.number(),
});

export const fundSummarySchema = z.object({
  code: fundCodeSchema,
  name: z.string().meta({ example: "VT AJ Bell Cautious I Acc" }),
  price: moneySchema,
  priceDate: z
    .string()
    .meta({ description: "Date the price applies to, as supplied upstream." }),
  ongoingChargePercent: z.number().meta({ example: 0.3 }),
  sector: z.string().meta({ example: "Flexible Investment" }),
  analystRating: z.number().int().min(1).max(5).nullable(),
  analystRatingLabel: z.string().nullable().meta({ example: "Neutral" }),
  riskRating: z
    .number()
    .int()
    .min(1)
    .max(7)
    .nullable()
    .meta({ description: "Synthetic risk and reward indicator (SRRI)." }),
  lastUpdated: z.iso.datetime().meta({
    description: "When this service last refreshed the fund from upstream.",
  }),
});

export const fundSchema = fundSummarySchema.extend({
  objective: z.string(),
  documents: z.array(fundDocumentSchema),
  assetAllocation: z.array(assetAllocationSchema),
  topHoldings: z.array(holdingSchema),
});

export const SORT_FIELDS = [
  "name",
  "price",
  "ongoingChargePercent",
  "analystRating",
  "riskRating",
] as const;

export const listQuerySchema = z.object({
  maxOngoingCharge: z.coerce.number().nonnegative().optional().meta({
    description:
      "Only funds with an ongoing charge at or below this percentage.",
  }),
  minAnalystRating: z.coerce.number().int().min(1).max(5).optional().meta({
    description:
      "Only funds rated at or above this. Unrated funds are excluded.",
  }),
  maxRiskRating: z.coerce.number().int().min(1).max(7).optional().meta({
    description:
      "Only funds with a risk rating at or below this. Unrated funds are excluded.",
  }),
  sector: z
    .string()
    .min(1)
    .optional()
    .meta({ description: "Exact sector name." }),
  sort: z.enum(SORT_FIELDS).optional().meta({
    description:
      "Defaults to name. Null values sort last; ties are broken by code.",
  }),
  order: z
    .enum(["asc", "desc"])
    .optional()
    .meta({ description: "Defaults to asc." }),
});

export const errorSchema = z.object({ error: z.string() });

export const validationErrorSchema = z.object({
  error: z.literal("Invalid request"),
  details: z.object({
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.string(), z.array(z.string())),
  }),
});

export const serverErrorSchema = z.object({
  error: z.literal("Internal server error"),
  requestId: z.uuid(),
});
