import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as kits from "../controllers/kits.controller.js";

export const kitsRouter = Router();

kitsRouter.use(requireAuth);

kitsRouter.post("/", asyncHandler(kits.create));
kitsRouter.post("/bulk", asyncHandler(kits.createBulk));
kitsRouter.get("/", asyncHandler(kits.list));
kitsRouter.get("/:id", asyncHandler(kits.getOne));
kitsRouter.patch("/:id", asyncHandler(kits.update));
kitsRouter.delete("/:id", asyncHandler(kits.remove));
kitsRouter.post("/:id/regenerate", asyncHandler(kits.regenerate));
