import { z } from "zod";
import { generateJSON } from "@/lib/llm";
import { untrusted, SYSTEM_GUARD } from "./prompts";

const BriefSchema = z.object({ summary: z.string(), what_they_do: z.string() });

export interface BriefContext {
  company: string;
  crawledText: string;
  searchText: string;
}

/**
 * Company brief from crawled pages + public discussion (brief §3). Honest by
 * construction: if little was found, it says so rather than fabricating a
 * company (brief §10).
 */
export async function generateBrief(
  ctx: BriefContext,
  sources: string[],
): Promise<{ summary: string; what_they_do: string; sources: string[] }> {
  const material = [ctx.crawledText, ctx.searchText].filter(Boolean).join("\n\n");

  if (!material.trim()) {
    return {
      summary: `No public information could be retrieved for ${ctx.company || "this company"}.`,
      what_they_do: "Unknown — the company site could not be read and no public discussion was found.",
      sources: [],
    };
  }

  const prompt = [
    `Write a short, factual brief for the company "${ctx.company}" using only the material below.`,
    "If the material does not establish what the company does, say that plainly.",
    "Do not invent products, funding, size, or values that are not present in the material.",
    "",
    'Return JSON: {"summary","what_they_do"}',
    "",
    untrusted("COMPANY MATERIAL", material),
  ].join("\n");

  const raw = await generateJSON({ system: SYSTEM_GUARD, prompt, schema: BriefSchema, temperature: 0.3 });
  return { ...raw, sources };
}
