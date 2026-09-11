import { createHash } from "node:crypto";

/** Normalises and hashes (jd, company_url) so a duplicate submission by the same user is detectable. */
export function hashJdAndCompany(jd: string, companyUrl: string): string {
  const normalised = `${jd.trim().toLowerCase()}::${companyUrl.trim().toLowerCase()}`;
  return createHash("sha256").update(normalised).digest("hex");
}
