import { rateLimit } from "express-rate-limit";

interface RateLimitOptions {
  windowMs?: number;
  limit?: number;
}

export const createRateLimiter = ({
  windowMs = 60_000,
  limit = 100,
}: RateLimitOptions = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests" },
  });
