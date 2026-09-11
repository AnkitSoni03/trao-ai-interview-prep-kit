import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let connected = false;

export async function connectToDatabase(): Promise<void> {
  if (connected) return;
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to backend/.env (see .env.example).");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  connected = true;
  logger.info("Connected to MongoDB");
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
