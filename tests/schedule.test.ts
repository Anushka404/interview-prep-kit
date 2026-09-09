import { describe, it, expect } from "vitest";
import { buildSchedule } from "@/lib/pipeline/schedule";
import type { Question, Requirement } from "@/lib/schema";

const req = (id: string, priority: "must" | "nice"): Requirement => ({
  id,
  text: id,
  kind: "technical",
  priority,
});

const q = (id: string, reqIds: string[], difficulty: 1 | 2 | 3): Question => ({
  id,
  requirement_ids: reqIds,
  category: "technical",
  prompt: "",
  answer_outline: "",
  difficulty,
});

describe("buildSchedule", () => {
  const reqs = [req("r1", "must"), req("r2", "must"), req("r3", "nice")];
  const qs = [q("q1", ["r1"], 3), q("q2", ["r2"], 2), q("q3", ["r3"], 1), q("q4", ["r1"], 1)];

  it("produces exactly the number of days requested", () => {
    for (const d of [1, 3, 5, 60]) {
      expect(buildSchedule(reqs, qs, d).days).toHaveLength(d);
    }
  });

  it("places every question exactly once across the days", () => {
    const s = buildSchedule(reqs, qs, 3);
    const placed = s.days.flatMap((d) => d.question_ids).sort();
    expect(placed).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("every must-have requirement appears somewhere in the schedule", () => {
    const s = buildSchedule(reqs, qs, 5);
    const scheduledReqs = new Set(
      s.days.flatMap((d) => d.question_ids).flatMap((id) => qs.find((x) => x.id === id)!.requirement_ids),
    );
    for (const r of reqs.filter((x) => x.priority === "must")) {
      expect(scheduledReqs.has(r.id)).toBe(true);
    }
  });

  it("front-loads the hardest material into earlier days", () => {
    const s = buildSchedule(reqs, qs, 4);
    const dayOf = (qid: string) => s.days.findIndex((d) => d.question_ids.includes(qid));
    // q1 (difficulty 3, must) must not land later than q3 (difficulty 1, nice).
    expect(dayOf("q1")).toBeLessThanOrEqual(dayOf("q3"));
  });

  it("uses integer minutes only", () => {
    const s = buildSchedule(reqs, qs, 3);
    for (const d of s.days) expect(Number.isInteger(d.minutes)).toBe(true);
  });

  it("handles a 1-day schedule by putting everything in day 1", () => {
    const s = buildSchedule(reqs, qs, 1);
    expect(s.days[0].question_ids).toHaveLength(4);
  });

  it("handles more days than questions, leaving later days empty", () => {
    const s = buildSchedule(reqs, qs, 10);
    expect(s.days).toHaveLength(10);
    expect(s.days.flatMap((d) => d.question_ids)).toHaveLength(4);
    expect(s.days.at(-1)!.question_ids).toHaveLength(0);
  });
});
