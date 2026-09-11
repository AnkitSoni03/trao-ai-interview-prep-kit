import type { Request, Response } from "express";
import { z } from "zod";
import * as kitService from "../services/kitService.js";
import { HttpError } from "../middleware/errorHandler.js";

const createKitSchema = z.object({
  jd: z.string().min(1, "Job description is required"),
  company_url: z.string().url("company_url must be a valid URL"),
  days: z.number().int().positive().max(365),
});

const bulkCreateSchema = z.array(createKitSchema).min(1).max(50);

const regenerateSchema = z.object({
  section: z.enum(["company_brief", "schedule", "technical", "behavioural", "system-design", "company-fit"]),
});

function userId(req: Request): string {
  if (!req.user) throw new HttpError(401, "NOT_AUTHENTICATED", "Sign in required");
  return req.user.userId;
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = createKitSchema.parse(req.body);
  const record = await kitService.createKit(userId(req), input);
  res.status(202).json({ kit: record });
}

export async function createBulk(req: Request, res: Response): Promise<void> {
  const inputs = bulkCreateSchema.parse(req.body);
  const uid = userId(req);
  const records = await Promise.all(inputs.map((input) => kitService.createKit(uid, input)));
  res.status(202).json({ kits: records });
}

export async function list(req: Request, res: Response): Promise<void> {
  const records = await kitService.listKits(userId(req));
  res.status(200).json({ kits: records });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const record = await kitService.getOwnedKit(userId(req), req.params.id);
  res.status(200).json({ kit: record });
}

export async function update(req: Request, res: Response): Promise<void> {
  const record = await kitService.saveEditedKit(userId(req), req.params.id, req.body);
  res.status(200).json({ kit: record });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await kitService.deleteOwnedKit(userId(req), req.params.id);
  res.status(204).send();
}

export async function regenerate(req: Request, res: Response): Promise<void> {
  const { section } = regenerateSchema.parse(req.body);
  const kit = await kitService.regenerateSection(userId(req), req.params.id, section);
  res.status(200).json({ kit });
}
