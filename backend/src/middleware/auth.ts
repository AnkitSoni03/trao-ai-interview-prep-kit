import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthPayload {
  userId: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const SESSION_COOKIE = "trao_session";

// In production the frontend (Vercel) and backend (Render/Railway) are different domains, so
// the session cookie is cross-site from the browser's point of view - that requires
// SameSite=None (paired with Secure, which browsers mandate alongside None). Locally both run
// on localhost (different ports only), which the cookie spec treats as same-site, so Lax works
// and avoids needing HTTPS in dev.
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function issueSessionCookie(res: Response, payload: AuthPayload): void {
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
  res.cookie(SESSION_COOKIE, token, cookieOptions);
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** Rejects a request with no/invalid/expired session. Nothing behind this runs for a signed-out visitor. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: { code: "NOT_AUTHENTICATED", message: "Sign in required" } });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ error: { code: "SESSION_EXPIRED", message: "Session expired or invalid, please sign in again" } });
  }
}
