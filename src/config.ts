import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_PATH: z.string().default("funds.db"),
  FUND_SOURCE_URL: z.url(),
  FUND_CODES: z.string().min(1),
  REFRESH_CRON: z.string().default("05 12 * * *"),
  FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

const env = envSchema.parse(process.env);
export const config = {
  port: env.PORT,
  dbPath: env.DB_PATH,
  fundSourceUrl: env.FUND_SOURCE_URL,
  fundCodes: env.FUND_CODES.split(",")
    .map((c) => c.trim())
    .filter(Boolean),
  refreshCron: env.REFRESH_CRON,
  fetchTimeoutMs: env.FETCH_TIMEOUT_MS,
};
