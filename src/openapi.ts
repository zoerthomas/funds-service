import { z } from "zod";
import {
  errorSchema,
  fundCodeSchema,
  fundSchema,
  fundSummarySchema,
  listQuerySchema,
  serverErrorSchema,
  validationErrorSchema,
} from "./schemas";

type JsonSchema = Record<string, unknown>;

const toSchema = (schema: z.ZodType): JsonSchema =>
  z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "output",
    unrepresentable: "any",
  }) as JsonSchema;

const jsonResponse = (description: string, schema: z.ZodType) => ({
  description,
  content: { "application/json": { schema: toSchema(schema) } },
});

const queryParameters = () => {
  const { properties = {}, required = [] } = toSchema(listQuerySchema) as {
    properties?: Record<string, JsonSchema>;
    required?: string[];
  };
  return Object.entries(properties).map(
    ([name, { description, ...schema }]) => ({
      name,
      in: "query",
      description,
      required: required.includes(name),
      schema,
    }),
  );
};

const validationError = jsonResponse(
  "Invalid path or query parameters.",
  validationErrorSchema,
);
const tooManyRequests = jsonResponse(
  "Rate limit exceeded (100 requests per minute per client). See the Retry-After header.",
  errorSchema,
);
const serverError = jsonResponse(
  "Unexpected error. The cause is logged server-side under the returned requestId.",
  serverErrorSchema,
);

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Funds API",
    version: "1.0.0",
    description: [
      "Read-only API serving fund data fetched from an upstream source and refreshed on a schedule.",
      "All prices are in GBX (pence). Upstream GBP prices are multiplied by 100 and not rounded.",
      "analystRating, analystRatingLabel and riskRating are null when upstream has no value.",
      "There is no pagination; the dataset is small.",
    ].join("\n\n"),
  },
  paths: {
    "/funds": {
      get: {
        operationId: "listFunds",
        summary: "List funds",
        description:
          "Returns fund summaries, optionally filtered and sorted. Filters combine with AND.",
        parameters: queryParameters(),
        responses: {
          "200": jsonResponse(
            "Matching funds (an empty array if none match).",
            z.array(fundSummarySchema),
          ),
          "400": validationError,
          "429": tooManyRequests,
          "500": serverError,
        },
      },
    },
    "/funds/{code}": {
      get: {
        operationId: "getFund",
        summary: "Get one fund",
        parameters: [
          {
            name: "code",
            in: "path",
            required: true,
            description: fundCodeSchema.meta()?.description,
            schema: {
              type: "string",
              pattern: "^[A-Za-z0-9]{7}$",
              example: fundCodeSchema.meta()?.example,
            },
          },
        ],
        responses: {
          "200": jsonResponse("The fund.", fundSchema),
          "400": validationError,
          "404": jsonResponse("No fund with that code.", errorSchema),
          "429": tooManyRequests,
          "500": serverError,
        },
      },
    },
  },
};
