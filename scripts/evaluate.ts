import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { z } from "zod";

// Load env before importing anything that reads it. .env.local wins over .env.
dotenv.config({ path: ".env.local" });
dotenv.config();

import { runPipeline } from "@/lib/pipeline/orchestrator";
import { publicKit } from "@/lib/schema";

const CaseSchema = z.object({
  id: z.string(),
  jd: z.string(),
  company_url: z.string(),
  days: z.number().int().min(1),
});

/** Map an error to a stable code for the batch report. */
function classify(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (/GEMINI_API_KEY|not set/i.test(message)) return { code: "CONFIG_ERROR", message };
  if (/LLM call failed|RESOURCE_EXHAUSTED|quota/i.test(message)) return { code: "LLM_FAILED", message };
  if (/integrity check/i.test(message)) return { code: "INVALID_KIT", message };
  if (/unreachable|ENOTFOUND|ECONNREFUSED|invalid URL/i.test(message)) return { code: "COMPANY_UNREACHABLE", message };
  return { code: "PIPELINE_ERROR", message };
}

async function main() {
  const { values } = parseArgs({
    options: { input: { type: "string" }, output: { type: "string" } },
  });
  if (!values.input || !values.output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  const rawCases = JSON.parse(await readFile(values.input, "utf-8"));
  const cases = z.array(CaseSchema).parse(rawCases);
  console.error(`Running ${cases.length} case(s)...`);

  const kits = [];
  for (const c of cases) {
    const t0 = Date.now();
    try {
      const { kit } = await runPipeline(
        { jd: c.jd, company_url: c.company_url, days: c.days },
        (e) => {
          process.stderr.write(`  [${c.id}] ${e.step}:${e.status}${e.detail ? ` (${e.detail})` : ""}\n`);
        },
      );
      kits.push({ id: c.id, status: "ok", kit: publicKit(kit), error: null });
      console.error(`  [${c.id}] ok in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      // A failed case is recorded, never fatal to the run (brief §9).
      kits.push({ id: c.id, status: "failed", kit: null, error: classify(err) });
      console.error(`  [${c.id}] failed: ${classify(err).message}`);
    }
  }

  const output = { version: "1.0", generated_at: new Date().toISOString(), kits };
  await writeFile(values.output, JSON.stringify(output, null, 2));
  console.error(`Wrote ${kits.length} result(s) to ${values.output}`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
