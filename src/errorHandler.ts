import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
};

const clientErrorStatus = (err: unknown): number | undefined => {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : undefined;
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof z.ZodError) {
    res
      .status(400)
      .json({ error: "Invalid request", details: z.flattenError(err) });
    return;
  }

  const status = clientErrorStatus(err);
  if (status) {
    res.status(status).json({ error: "Bad request" });
    return;
  }

  const requestId = randomUUID();
  console.error(`[${requestId}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: "Internal server error", requestId });
};
