import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

export const config = configSchema.parse(process.env);
export const corsOrigins = config.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
