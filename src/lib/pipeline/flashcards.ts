import { z } from "zod";
import { generateJSON } from "@/lib/llm";
import { SYSTEM_GUARD } from "./prompts";
import type { Requirement } from "@/lib/schema";

const FlashcardDraftSchema = z.object({
  flashcards: z.array(
    z.object({
      front: z.string().min(1),
      back: z.string().min(1),
      requirement_ids: z.array(z.string()),
    }),
  ),
});

export interface FlashcardDraft {
  front: string;
  back: string;
  requirement_ids: string[];
}

/** Generate recall flashcards for the must-have requirements (one LLM call). */
export async function generateFlashcards(
  requirements: Requirement[],
  role: string,
): Promise<FlashcardDraft[]> {
  const musts = requirements.filter((r) => r.priority === "must");
  const target = (musts.length ? musts : requirements).slice(0, 12);
  if (target.length === 0) return [];

  const reqList = target.map((r) => `- ${r.id}: ${r.text}`).join("\n");
  const prompt = [
    `Create concise study flashcards for a ${role} interview, one or two per requirement.`,
    "front = a short prompt/term; back = the key facts a candidate must recall.",
    "Set requirement_ids to the requirement(s) each card covers, from this list only.",
    "",
    "Requirements:",
    reqList,
    "",
    'Return JSON: {"flashcards":[{"front","back","requirement_ids":[]}]}',
  ].join("\n");

  const raw = await generateJSON({ system: SYSTEM_GUARD, prompt, schema: FlashcardDraftSchema, temperature: 0.4 });
  const validIds = new Set(target.map((r) => r.id));
  return raw.flashcards.map((f) => ({
    ...f,
    requirement_ids: f.requirement_ids.filter((id) => validIds.has(id)),
  }));
}
