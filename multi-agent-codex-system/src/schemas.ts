import { z } from "zod";
import type { JsonSchemaDefinition } from "@openai/agents-core";
import { zodToJsonSchema } from "zod-to-json-schema";

const IntentionSchema = z.object({
  category: z
    .enum(["Feature", "Refactor", "BugFix", "Performance", "Security", "DevEx", "Architecture", "Testing"])
    .describe("High-level intention category"),
  title: z.string().min(5).max(160),
  summary: z.string().min(10).max(800),
  impactScope: z.enum(["local", "module", "system"]).default("module"),
  evidence: z.array(z.string()).default([]),
});
export type Intention = z.output<typeof IntentionSchema>;
const IntentionListSchema = z.array(IntentionSchema).min(1).max(12);

const RecommendationSchema = z.object({
  category: z.enum(["Code", "Tests", "Docs", "Tooling", "DevEx", "Observability"]),
  title: z.string().min(5).max(160),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  effort: z.enum(["Low", "Medium", "High"]).default("Medium"),
  description: z.string().min(10).max(400),
  location: z.string().max(200).optional().default(""),
  example: z.string().max(400).optional().default(""),
});
export type Recommendation = z.output<typeof RecommendationSchema>;
const RecommendationListSchema = z.array(RecommendationSchema).min(1).max(10);

const CiIssueSchema = z.object({
  source: z.enum(["lint", "tests", "build", "security"]).or(z.string()),
  severity: z.enum(["P0", "P1", "P2", "P3"]),
  title: z.string().min(5).max(160),
  summary: z.string().min(10).max(400),
  suggestedCommands: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  owner: z.string().optional(),
  autoFixable: z.boolean().default(false),
});
export type CiIssue = z.output<typeof CiIssueSchema>;
const CiIssueListSchema = z.array(CiIssueSchema).min(1).max(12);

const CiFixSchema = z.object({
  title: z.string().min(5).max(160),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  steps: z.array(z.string()).default([]),
  owner: z.string().optional(),
  etaHours: z.number().min(0).max(40).optional(),
  commands: z.array(z.string()).default([]),
});
export type CiFix = z.output<typeof CiFixSchema>;
const CiFixListSchema = z.array(CiFixSchema).min(1).max(15);

function buildJsonSchemaFromZod(schema: z.ZodTypeAny, name: string) {
  const json = zodToJsonSchema(schema, { name, target: "openAi" }) as any;
  if (json?.definitions?.[name]) {
    return json.definitions[name];
  }
  return json;
}

function buildJsonOutputType(schema: z.ZodTypeAny, name: string): JsonSchemaDefinition {
  return {
    type: "json_schema",
    name,
    strict: true,
    schema: buildJsonSchemaFromZod(schema, name),
  };
}

const IntentionOutputType = buildJsonOutputType(IntentionListSchema, "Intentions");
const RecommendationOutputType = buildJsonOutputType(RecommendationListSchema, "Recommendations");
const CiIssueOutputType = buildJsonOutputType(CiIssueListSchema, "CiIssueList");
const CiFixOutputType = buildJsonOutputType(CiFixListSchema, "CiFixList");

function coerceStructuredOutput<T>(value: unknown, schema: z.ZodType<T>, fallback: T): T {
  if (value == null) {
    return fallback;
  }
  try {
    const candidate = typeof value === "string" ? JSON.parse(value) : value;
    return schema.parse(candidate);
  } catch (error) {
    console.warn("Failed to parse structured agent output", error);
    return fallback;
  }
}

export {
  IntentionSchema,
  IntentionListSchema,
  RecommendationSchema,
  RecommendationListSchema,
  CiIssueSchema,
  CiIssueListSchema,
  CiFixSchema,
  CiFixListSchema,
  IntentionOutputType,
  RecommendationOutputType,
  CiIssueOutputType,
  CiFixOutputType,
  coerceStructuredOutput,
};
