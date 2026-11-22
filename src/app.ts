import express, { Application, Request, Response } from "express";
import helmet from "helmet";

import { errorHandler, notFoundHandler } from "./errorHandler";
import { getFund, listFunds } from "./fundDb";
import { openApiDocument } from "./openapi";
import { createRateLimiter } from "./rateLimiter";
import { fundCodeSchema, listQuerySchema } from "./schemas";

const app: Application = express();

app.use(helmet());
app.use(createRateLimiter());
app.disable("x-powered-by");

app.get("/funds/:code", (req: Request, res: Response) => {
  const code = fundCodeSchema.parse(req.params.code);
  const fund = getFund(code);

  if (!fund) {
    res.status(404).json({ error: `Fund ${code} not found` });
    return;
  }
  res.json(fund);
});

app.get("/funds", (req: Request, res: Response) => {
  res.json(listFunds(listQuerySchema.parse(req.query)));
});

app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiDocument);
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
