import { z } from "zod";
import { generateJSON } from "@/lib/llm";
import { untrusted, SYSTEM_GUARD } from "./prompts";
import { QuestionCategory, type Requirement } from "@/lib/schema";

const DraftSchema = z.object({
  questions: z.array(
    z.object({
      requirement_ids: z.array(z.string()),
      prompt: z.string().min(1),
      answer_outline: z.string(),
      difficulty: z.number().int().min(1).max(3),
    }),
  ),
});

export interface QuestionDraft {
  requirement_ids: string[];
  category: z.infer<typeof QuestionCategory>;
  prompt: string;
  answer_outline: string;
  difficulty: number;
}

export interface CategoryContext {
  role: string;
  seniority: string;
  /** What was learned about how the company interviews, if anything. */
  hiringContext: string;
}

const CATEGORY_BRIEF: Record<string, string> = {
  technical: "hands-on technical questions probing the specific skills and experience required",
  behavioural: "behavioural questions using real situations (collaboration, conflict, mentoring, ownership)",
  "system-design": "system/architecture design questions appropriate to the role's seniority",
  "company-fit": "company-fit and motivation questions tied to what this company does and how it hires",
};

/**
 * Step 5 — generate questions for one category over the requirements mapped to it
 * (brief §3). Categories are generated in separate calls so a "5 years React"
 * requirement yields technical questions while "mentoring juniors" yields
 * behavioural ones. If a hiring process was found (e.g. a take-home + system
 * design round), it shapes the questions.
 */
export async function generateQuestionsForCategory(
  category: QuestionDraft["category"],
  requirements: Requirement[],
  ctx: CategoryContext,
  perRequirement = 1,
): Promise<QuestionDraft[]> {
  if (requirements.length === 0) return [];

  const reqList = requirements.map((r) => `- ${r.id} [${r.priority}]: ${r.text}`).join("\n");
  const prompt = [
    `Generate ${category} interview questions for a ${ctx.seniority} ${ctx.role} role.`,
    `Category focus: ${CATEGORY_BRIEF[category]}.`,
    `Write at least ${perRequirement} distinct question(s) for EACH requirement below —`,
    `aim for one focused question per requirement. Combine two requirements into a single`,
    `question only when they are genuinely inseparable. Each question must set`,
    `requirement_ids to the requirement id(s) it actually covers (from this list only).`,
    "Give a concise answer_outline (what a strong answer includes) and difficulty 1-3.",
    ctx.hiringContext
      ? "Tailor questions to the company's known interview process where relevant."
      : "",
    "",
    "Requirements:",
    reqList,
    ctx.hiringContext ? "\n" + untrusted("KNOWN HIRING PROCESS", ctx.hiringContext) : "",
    "",
    'Return JSON: {"questions":[{"requirement_ids":[],"prompt","answer_outline","difficulty"}]}',
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await generateJSON({ system: SYSTEM_GUARD, prompt, schema: DraftSchema, temperature: 0.5 });

  const validIds = new Set(requirements.map((r) => r.id));
  return raw.questions.map((q) => ({
    ...q,
    category,
    // Keep only ids we actually asked about; fall back to all provided reqs if the
    // model returned none, so the question still counts toward coverage.
    requirement_ids: q.requirement_ids.filter((id) => validIds.has(id)).length
      ? q.requirement_ids.filter((id) => validIds.has(id))
      : requirements.map((r) => r.id),
  }));
}
