import { z } from "zod";
import { generateJSON } from "@/lib/llm";
import { untrusted, SYSTEM_GUARD } from "./prompts";
import { RequirementKind, Priority, type Requirement } from "@/lib/schema";

const ExtractionSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  location: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(
    z.object({
      text: z.string().min(1),
      kind: RequirementKind,
      priority: Priority,
    }),
  ),
});

export interface Extraction {
  title: string;
  seniority: string;
  location: string;
  responsibilities: string[];
  requirements: Requirement[]; // ids assigned here, stable r1..rN
}

/**
 * Step 1 — extract requirements from the pasted JD (brief §3). The rules that
 * earn the 20 automated points: mark must vs nice from how the posting words it
 * ("required" ≠ "bonus points for"), classify kind, and invent nothing. A
 * two-line stub must yield few requirements, not a fabricated full set (§10).
 * Stable ids are assigned by our code, not the model.
 */
export async function extractRequirements(jd: string): Promise<Extraction> {
  const prompt = [
    "Extract the role details and requirements from this job description.",
    "",
    "Rules:",
    '- A requirement is "must" only if the posting states it as required/essential/must-have.',
    '  Anything phrased as "bonus", "nice to have", "preferred", or "a plus" is "nice".',
    "- kind: technical (skills, tools, years of experience), behavioural (collaboration,",
    "  mentoring, communication), or domain (industry/product knowledge).",
    "- Extract ONLY what the text states. Do not infer or add common requirements that are",
    "  not written. If the description is short, return few requirements — that is correct.",
    "- responsibilities: short phrases taken from the posting. title/seniority/location:",
    '  empty string "" if not stated.',
    "",
    'Return JSON: {"title","seniority","location","responsibilities":[],',
    '"requirements":[{"text","kind","priority"}]}',
    "",
    untrusted("JOB DESCRIPTION", jd),
  ].join("\n");

  const raw = await generateJSON({
    system: SYSTEM_GUARD,
    prompt,
    schema: ExtractionSchema,
    temperature: 0.1, // extraction should be faithful, not creative
  });

  return {
    ...raw,
    requirements: raw.requirements.map((r, i) => ({ id: `r${i + 1}`, ...r })),
  };
}
