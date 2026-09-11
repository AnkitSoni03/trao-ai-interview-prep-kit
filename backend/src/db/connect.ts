import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let connected = false;

// A `mongodb+srv://` URI needs a DNS SRV/TXT lookup, which Node resolves through its own
// c-ares client rather than the OS resolver `fetch()`/`dns.lookup()` use. On some networks the
// OS resolver works fine (nslookup succeeds) while Node's c-ares client times out against
// whatever nameserver it inherited - pointing it at public resolvers fixes that without
// touching the OS's own DNS config.
dns.setServers(["1.1.1.1", "8.8.8.8", "8.8.4.4"]);

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
