import type { z } from "zod";
import type {
  assetAllocationSchema,
  fundDocumentSchema,
  fundSchema,
  fundSummarySchema,
  holdingSchema,
  listQuerySchema,
  moneySchema,
} from "./schemas";

export type Money = z.infer<typeof moneySchema>;
export type FundDocument = z.infer<typeof fundDocumentSchema>;
export type AssetAllocation = z.infer<typeof assetAllocationSchema>;
export type Holding = z.infer<typeof holdingSchema>;
export type Fund = z.infer<typeof fundSchema>;
export type FundSummary = z.infer<typeof fundSummarySchema>;

export type FundFilters = z.infer<typeof listQuerySchema>;
export type FundSortField = NonNullable<FundFilters["sort"]>;
export type SortOrder = NonNullable<FundFilters["order"]>;

export interface FundRow {
  code: string;
  name: string;

  price_amount: number;
  price_date: string;

  ongoing_charge_percent: number;
  sector: string;
  analyst_rating: number | null;
  analyst_rating_label: string | null;
  risk_rating: number | null;

  objective: string;
  documents: string;
  asset_allocation: string;
  top_holdings: string;

  last_updated: string;
}
