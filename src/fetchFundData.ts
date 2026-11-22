import { parseFundResponse } from "./fundMapper";
import { upsertFund } from "./fundDb";
import { config } from "./config";

const fetchFundJson = async (code: string): Promise<unknown> => {
  const url = config.fundSourceUrl.replace("{code}", encodeURIComponent(code));
  const response = await fetch(url, {
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
  });
  if (!response.ok) {
    const body: string = await response.text();
    throw new Error(`Upstream responded ${response.status}: ${body}`);
  }
  return await response.json();
};

export async function refreshFunds() {
  const fetchedAt = new Date().toISOString();

  for (const code of config.fundCodes) {
    try {
      const json = await fetchFundJson(code);
      const fund = parseFundResponse(json, code, fetchedAt);
      try {
        upsertFund(fund);
      } catch (error) {
        console.error(`Failed to store fund ${code}:`, error);
      }
    } catch (error) {
      console.error(`Failed to fetch fund ${code}:`, error);
    }
  }
}
