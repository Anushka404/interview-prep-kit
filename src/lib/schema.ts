import { z } from "zod";

/**
 * Appendix A — the exact kit structure. Field names must match the brief.
 * We add three optional state fields (origin/edited/pinned) to questions and
 * flashcards to solve the builder problem (§6); they are stripped from batch
 * output by publicKit() so the graded structure stays clean.
 */

export const RequirementKind = z.enum(["technical", "behavioural", "domain"]);
export const Priority = z.enum(["must", "nice"]);
export const QuestionCategory = z.enum([
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
]);

// Internal-only provenance for the builder. Not part of Appendix A.
const ItemState = {
  origin: z.enum(["generated", "user"]).optional(),
  edited: z.boolean().optional(),
  pinned: z.boolean().optional(),
};

export const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: RequirementKind,
  priority: Priority,
});

export const QuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: QuestionCategory,
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
  ...ItemState,
});

export const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  ...ItemState,
});

export const ScheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().min(0),
});

export const KitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int(),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(RequirementSchema),
  }),
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: z.object({
    days_available: z.number().int().min(1),
    days: z.array(ScheduleDaySchema),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().min(0),
  }),
});

export type Requirement = z.infer<typeof RequirementSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;
export type Kit = z.infer<typeof KitSchema>;

/**
 * Structural invariants the type system can't express, checked before save and
 * in the batch validator. Returns a list of human-readable problems (empty = ok).
 */
export function validateKitIntegrity(kit: Kit): string[] {
  const problems: string[] = [];
  const reqIds = new Set(kit.role.requirements.map((r) => r.id));
  const qIds = new Set(kit.questions.map((q) => q.id));

  // Every question references requirement ids that exist.
  for (const q of kit.questions) {
    for (const rid of q.requirement_ids) {
      if (!reqIds.has(rid)) problems.push(`question ${q.id} references missing requirement ${rid}`);
    }
  }
  // Every schedule question_id refers to a real question.
  for (const day of kit.schedule.days) {
    for (const qid of day.question_ids) {
      if (!qIds.has(qid)) problems.push(`schedule day ${day.day} references missing question ${qid}`);
    }
  }
  // Schedule spans exactly the days requested.
  if (kit.schedule.days.length !== kit.schedule.days_available) {
    problems.push(
      `schedule has ${kit.schedule.days.length} days, expected ${kit.schedule.days_available}`,
    );
  }
  // Every must-have requirement appears somewhere in the schedule.
  const scheduledReqs = new Set<string>();
  for (const day of kit.schedule.days) {
    for (const qid of day.question_ids) {
      const q = kit.questions.find((x) => x.id === qid);
      q?.requirement_ids.forEach((r) => scheduledReqs.add(r));
    }
  }
  for (const r of kit.role.requirements) {
    if (r.priority === "must" && !scheduledReqs.has(r.id)) {
      problems.push(`must-have requirement ${r.id} is not in the schedule`);
    }
  }
  return problems;
}

/** Strip internal builder state so batch output is clean Appendix A. */
export function publicKit(kit: Kit): Kit {
  const strip = <T extends Record<string, unknown>>(o: T) => {
    const { origin, edited, pinned, ...rest } = o as Record<string, unknown>;
    return rest;
  };
  return {
    ...kit,
    questions: kit.questions.map(strip) as Question[],
    flashcards: kit.flashcards.map(strip) as Flashcard[],
  };
}
