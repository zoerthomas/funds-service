import cron from "node-cron";

import app from "./app";
import { config } from "./config";
import { refreshFunds } from "./fetchFundData";

app.listen(config.port, () => {
  console.log(`Server is running on http://localhost:${config.port}`);
  refreshFunds().catch((err) => console.error("Initial refresh failed:", err));
  cron.schedule(config.refreshCron, () => refreshFunds(), {
    timezone: "Europe/London",
  });
});
