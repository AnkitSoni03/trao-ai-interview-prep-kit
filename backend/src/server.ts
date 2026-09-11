import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { connectToDatabase } from "./db/connect.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Add it to backend/.env (see .env.example).");
  }

  await connectToDatabase();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Backend listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
