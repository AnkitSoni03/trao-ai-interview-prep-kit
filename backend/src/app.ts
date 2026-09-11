import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { kitsRouter } from "./routes/kits.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/kits", kitsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
