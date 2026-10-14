import { Prisma } from "@prisma/client";

const safeMetaFields = new Set([
  "modelName",
  "column",
  "field_name",
  "target",
  "constraint",
  "cause",
]);

function sanitizeText(value: string): string {
  return value
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'`]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(password(?:_hash|Hash)?|jwt_secret|database_url|authorization|token)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/\b(?:sql\s+)?params?\s*[:=]\s*(?:\[[^\]]*\]|\{[^}]*\}|[^\n]+)/gi, "params=[REDACTED]")
    .replace(/\b(?:SELECT|INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b[\s\S]*/i, "[REDACTED SQL]");
}

function sanitizeMeta(meta: Prisma.PrismaClientKnownRequestError["meta"]) {
  if (!meta) return undefined;
  const safeEntries: Record<string, string | number | string[]> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!safeMetaFields.has(key)) continue;
    if (typeof value === "string" || typeof value === "number") {
      safeEntries[key] = sanitizeText(String(value));
      continue;
    }
    if (
      Array.isArray(value) &&
      value.every(
        (entry) => typeof entry === "string" || typeof entry === "number",
      )
    ) {
      safeEntries[key] = value.map((entry) => sanitizeText(String(entry)));
    }
  }
  return Object.keys(safeEntries).length ? safeEntries : undefined;
}

export function logUnexpectedApiError(error: unknown, nodeEnv: string): void {
  const details: Record<string, unknown> = {
    class: error instanceof Error ? error.name : "UnknownError",
  };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    details.code = error.code;
    details.meta = sanitizeMeta(error.meta);
  }
  if (nodeEnv === "development" && error instanceof Error) {
    details.message = sanitizeText(error.message);
    if (error.stack) details.stack = sanitizeText(error.stack);
  }

  console.error("Unhandled API error.", details);
}
