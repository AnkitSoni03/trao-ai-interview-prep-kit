import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Required to run the web server (checked at server startup, not here) but NOT to run
  // `npm run evaluate`, which never touches the database.
  MONGODB_URI: z.string().optional().default(""),

  // Required to run the web server (checked at server startup). Not needed by evaluate.
  JWT_SECRET: z.string().optional().default(""),
  JWT_EXPIRES_IN: z.string().default("7d"),

  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-flash-lite-latest"),

  TAVILY_API_KEY: z.string().optional().default(""),

  CRAWL_USER_AGENT: z.string().default("TraoPrepKitBot/1.0"),
  CRAWL_MAX_PAGES_PER_SITE: z.coerce.number().default(8),
  CRAWL_REQUEST_TIMEOUT_MS: z.coerce.number().default(10000),
  CRAWL_MIN_DELAY_MS: z.coerce.number().default(500),

  ALLOW_PRIVATE_NETWORK_FETCH: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check backend/.env against .env.example.");
}

export const env = parsed.data;
