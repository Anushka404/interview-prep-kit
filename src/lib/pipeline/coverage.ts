import type { Question, Requirement } from "@/lib/schema";

/**
 * Coverage is a deterministic decision made by our code, not the model (brief §3).
 * A requirement is "covered" when at least one question references its id.
 */

export function coveredRequirementIds(questions: Question[]): Set<string> {
  const covered = new Set<string>();
  for (const q of questions) for (const rid of q.requirement_ids) covered.add(rid);
  return covered;
}

/** All requirements (must + nice) with no question against them. */
export function findUncovered(requirements: Requirement[], questions: Question[]): string[] {
  const covered = coveredRequirementIds(questions);
  return requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
}

/** Only the must-haves left uncovered — this is what the second pass must close. */
export function uncoveredMust(requirements: Requirement[], questions: Question[]): string[] {
  const covered = coveredRequirementIds(questions);
  return requirements.filter((r) => r.priority === "must" && !covered.has(r.id)).map((r) => r.id);
}
