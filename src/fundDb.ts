import Database from "better-sqlite3";
import {
  Fund,
  FundSortField,
  FundFilters,
  FundSummary,
  FundRow,
} from "./types";
import { config } from "./config";
import { fundSchema } from "./schemas";

export const fundDb = new Database(config.dbPath);
fundDb.pragma("journal_mode = WAL");

const createTable = `
    CREATE TABLE IF NOT EXISTS funds (
      code                   TEXT PRIMARY KEY,
      name                   TEXT NOT NULL,
      price_amount           REAL NOT NULL,
      price_date             TEXT NOT NULL,
      ongoing_charge_percent REAL NOT NULL,
      sector                 TEXT NOT NULL,
      analyst_rating         INTEGER,
      analyst_rating_label   TEXT,
      risk_rating            INTEGER,
      objective              TEXT NOT NULL,
      documents              TEXT NOT NULL,
      asset_allocation       TEXT NOT NULL,
      top_holdings           TEXT NOT NULL,
      last_updated           TEXT NOT NULL
    );
  `;

fundDb.exec(createTable);

const upsertStmt = fundDb.prepare(`
    INSERT INTO funds (
      code, name, price_amount, price_date, ongoing_charge_percent, sector,
      analyst_rating, analyst_rating_label, risk_rating, objective,
      documents, asset_allocation, top_holdings, last_updated
    ) VALUES (
      @code, @name, @priceAmount, @priceDate, @ongoingChargePercent, @sector,
      @analystRating, @analystRatingLabel, @riskRating, @objective,
      @documents, @assetAllocation, @topHoldings, @lastUpdated
    )
    ON CONFLICT(code) DO UPDATE SET
      name                   = excluded.name,
      price_amount           = excluded.price_amount,
      price_date             = excluded.price_date,
      ongoing_charge_percent = excluded.ongoing_charge_percent,
      sector                 = excluded.sector,
      analyst_rating         = excluded.analyst_rating,
      analyst_rating_label   = excluded.analyst_rating_label,
      risk_rating            = excluded.risk_rating,
      objective              = excluded.objective,
      documents              = excluded.documents,
      asset_allocation       = excluded.asset_allocation,
      top_holdings           = excluded.top_holdings,
      last_updated           = excluded.last_updated
  `);

export const upsertFund = fundDb.transaction((fund: Fund) => {
  upsertStmt.run({
    code: fund.code,
    name: fund.name,
    priceAmount: fund.price.amount,
    priceDate: fund.priceDate,
    ongoingChargePercent: fund.ongoingChargePercent,
    sector: fund.sector,
    analystRating: fund.analystRating,
    analystRatingLabel: fund.analystRatingLabel,
    riskRating: fund.riskRating,
    objective: fund.objective,
    documents: JSON.stringify(fund.documents),
    assetAllocation: JSON.stringify(fund.assetAllocation),
    topHoldings: JSON.stringify(fund.topHoldings),
    lastUpdated: fund.lastUpdated,
  });
});

export const getFund = (code: string): Fund | undefined => {
  const row = fundDb.prepare(`SELECT * FROM funds WHERE code = ?`).get(code) as
    FundRow | undefined;
  if (!row) return undefined;

  const parsed = fundSchema.safeParse({
    code: row.code,
    name: row.name,
    price: { amount: row.price_amount, currency: "GBX" },
    priceDate: row.price_date,
    ongoingChargePercent: row.ongoing_charge_percent,
    sector: row.sector,
    analystRating: row.analyst_rating,
    analystRatingLabel: row.analyst_rating_label,
    riskRating: row.risk_rating,
    objective: row.objective,
    documents: JSON.parse(row.documents),
    assetAllocation: JSON.parse(row.asset_allocation),
    topHoldings: JSON.parse(row.top_holdings),
    lastUpdated: row.last_updated,
  });
  if (!parsed.success) {
    throw new Error(`Stored fund ${code} is invalid`, { cause: parsed.error });
  }
  return parsed.data;
};

export const listFunds = (filters: FundFilters = {}): FundSummary[] => {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.maxOngoingCharge !== undefined) {
    where.push("ongoing_charge_percent <= @maxOngoingCharge");
    params.maxOngoingCharge = filters.maxOngoingCharge;
  }
  if (filters.minAnalystRating !== undefined) {
    where.push("analyst_rating >= @minAnalystRating");
    params.minAnalystRating = filters.minAnalystRating;
  }
  if (filters.maxRiskRating !== undefined) {
    where.push("risk_rating <= @maxRiskRating");
    params.maxRiskRating = filters.maxRiskRating;
  }
  if (filters.sector !== undefined) {
    where.push("sector = @sector");
    params.sector = filters.sector;
  }
  const SORT_COLUMNS: Record<FundSortField, string> = {
    name: "name",
    price: "price_amount",
    ongoingChargePercent: "ongoing_charge_percent",
    analystRating: "analyst_rating",
    riskRating: "risk_rating",
  };
  const column = SORT_COLUMNS[filters.sort ?? "name"];
  const direction = filters.order === "desc" ? "DESC" : "ASC";
  const rows = fundDb
    .prepare(
      `SELECT code, name, price_amount AS priceAmount, price_date AS priceDate,
                ongoing_charge_percent AS ongoingChargePercent, sector,
                analyst_rating AS analystRating,
                analyst_rating_label AS analystRatingLabel,
                risk_rating AS riskRating,
                last_updated AS lastUpdated
         FROM funds
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY ${column} ${direction} NULLS LAST, code`,
    )
    .all(params) as Array<Omit<FundSummary, "price"> & { priceAmount: number }>;
  return rows.map(({ priceAmount, ...rest }) => ({
    ...rest,
    price: { amount: priceAmount, currency: "GBX" as const },
  }));
};
