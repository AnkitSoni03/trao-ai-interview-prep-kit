#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "../pipeline/index.js";
import type { BatchCase, BatchOutput } from "../types/batch.js";
import { logger } from "../utils/logger.js";

/**
 * Mandatory batch entry point (Section 9):
 *   npm run evaluate -- --input <cases.json> --output <kits.json>
 *
 * Runs the exact same pipeline the web app uses (src/pipeline/index.ts) against a list of
 * cases and writes one JSON file in the Appendix B shape. Never touches MongoDB or auth.
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
    },
  });

  if (!values.input || !values.output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  // `npm run evaluate` (at the repo root) runs this script with backend/ as the working
  // directory (npm workspaces), so relative --input/--output paths must be resolved against
  // where the user actually invoked npm from, not against backend/.
  const baseDir = process.env.INIT_CWD || process.cwd();
  const inputPath = path.resolve(baseDir, values.input);
  const outputPath = path.resolve(baseDir, values.output);

  const raw = await readFile(inputPath, "utf-8");
  const cases = JSON.parse(raw) as BatchCase[];

  if (!Array.isArray(cases)) {
    console.error(`${inputPath} must contain a JSON array of cases`);
    process.exit(1);
  }

  const output: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: [],
  };

  for (const [i, c] of cases.entries()) {
    logger.info(`Running case ${i + 1}/${cases.length}`, { id: c.id });
    const result = await runPipeline(c, (event) => {
      logger.info(`  [${c.id}] ${event.step}: ${event.message}`);
    });
    output.kits.push(result);
    logger.info(`Finished case ${c.id}: ${result.status}`);
  }

  await writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
  logger.info(`Wrote ${output.kits.length} result(s) to ${outputPath}`);
}

main().catch((err) => {
  console.error("evaluate run failed:", err);
  process.exit(1);
});
