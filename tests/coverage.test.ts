import { describe, it, expect } from "vitest";
import { findUncovered, uncoveredMust, coveredRequirementIds } from "@/lib/pipeline/coverage";
import type { Question, Requirement } from "@/lib/schema";

const req = (id: string, priority: "must" | "nice"): Requirement => ({
  id,
  text: id,
  kind: "technical",
  priority,
});
const q = (id: string, reqIds: string[]): Question => ({
  id,
  requirement_ids: reqIds,
  category: "technical",
  prompt: "",
  answer_outline: "",
  difficulty: 2,
});

describe("coverage", () => {
  const reqs = [req("r1", "must"), req("r2", "must"), req("r3", "nice")];

  it("reports must-haves with no question as uncovered", () => {
    const qs = [q("q1", ["r1"])];
    expect(uncoveredMust(reqs, qs)).toEqual(["r2"]);
    expect(findUncovered(reqs, qs).sort()).toEqual(["r2", "r3"]);
  });

  it("reports nothing uncovered when every requirement has a question", () => {
    const qs = [q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])];
    expect(uncoveredMust(reqs, qs)).toEqual([]);
    expect(findUncovered(reqs, qs)).toEqual([]);
  });

  it("counts a requirement covered when any question references it", () => {
    const qs = [q("q1", ["r1", "r2"])];
    expect(coveredRequirementIds(qs)).toEqual(new Set(["r1", "r2"]));
    expect(uncoveredMust(reqs, qs)).toEqual([]);
  });

  it("leaves an uncovered nice-to-have out of the must-close set", () => {
    const qs = [q("q1", ["r1"]), q("q2", ["r2"])];
    expect(uncoveredMust(reqs, qs)).toEqual([]); // loop can stop
    expect(findUncovered(reqs, qs)).toEqual(["r3"]); // but it's still reported
  });
});
