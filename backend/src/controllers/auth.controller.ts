import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { clearSessionCookie, issueSessionCookie } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password } = credentialsSchema.parse(req.body);

  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash });

  issueSessionCookie(res, { userId: user.id, email: user.email });
  res.status(201).json({ user: { id: user.id, email: user.email } });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = credentialsSchema.parse(req.body);

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }

  issueSessionCookie(res, { userId: user.id, email: user.email });
  res.status(200).json({ user: { id: user.id, email: user.email } });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  res.status(200).json({ user: req.user ?? null });
}
