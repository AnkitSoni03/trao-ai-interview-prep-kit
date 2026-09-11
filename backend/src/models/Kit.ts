import { Schema, model, Types } from "mongoose";

export const KIT_STATUSES = [
  "pending",
  "researching",
  "generating",
  "checking_coverage",
  "ready",
  "failed",
] as const;
export type KitStatus = (typeof KIT_STATUSES)[number];

// The generated Kit (Appendix A shape) is stored as a loosely-typed subdocument —
// its authoritative shape lives in src/types/kit.ts and is enforced by
// pipeline/validateKit.ts before a document is ever saved here.
const kitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    input: {
      jd: { type: String, required: true },
      company_url: { type: String, required: true },
      days: { type: Number, required: true },
    },

    // A hash of (userId + normalised jd + normalised company_url) used to detect
    // resubmission of the same description/company pair (Section 10 edge case).
    contentHash: { type: String, required: true, index: true },

    status: { type: String, enum: KIT_STATUSES, default: "pending", required: true },
    progress: {
      step: { type: String, default: "" },
      message: { type: String, default: "" },
      updatedAt: { type: Date, default: Date.now },
    },

    kit: { type: Schema.Types.Mixed, default: null },
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null },
    },
  },
  { timestamps: true },
);

kitSchema.index({ userId: 1, contentHash: 1 });

export type KitDocId = Types.ObjectId;
export const KitRecord = model("Kit", kitSchema);
