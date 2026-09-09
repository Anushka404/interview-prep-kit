import { describe, it, expect } from "vitest";
import { KitSchema, validateKitIntegrity, publicKit, type Kit } from "@/lib/schema";

function makeKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "http://acme.test",
      role: "Backend Engineer",
      location: "Remote",
      jd_chars: 1200,
      researched_at: "2026-09-09T00:00:00Z",
      pages_used: ["http://acme.test/careers"],
    },
    company_brief: { summary: "s", what_they_do: "w", sources: ["http://acme.test"] },
    role: {
      title: "Backend Engineer",
      seniority: "senior",
      responsibilities: ["build APIs"],
      requirements: [
        { id: "r1", text: "5+ years Node", kind: "technical", priority: "must" },
        { id: "r2", text: "mentoring", kind: "behavioural", priority: "nice" },
      ],
    },
    questions: [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 3, origin: "generated" },
    ],
    flashcards: [{ id: "f1", front: "f", back: "b", requirement_ids: ["r1"] }],
    schedule: { days_available: 1, days: [{ day: 1, focus: "Technical", question_ids: ["q1"], minutes: 40 }] },
    coverage: { uncovered_requirement_ids: ["r2"], passes: 1 },
  };
}

describe("KitSchema", () => {
  it("accepts a well-formed kit", () => {
    expect(KitSchema.safeParse(makeKit()).success).toBe(true);
  });

  it("rejects a non-integer difficulty and out-of-range values", () => {
    const kit = makeKit();
    (kit.questions[0] as { difficulty: number }).difficulty = 2.5;
    expect(KitSchema.safeParse(kit).success).toBe(false);
  });

  it("rejects float minutes", () => {
    const kit = makeKit();
    (kit.schedule.days[0] as { minutes: number }).minutes = 40.5;
    expect(KitSchema.safeParse(kit).success).toBe(false);
  });
});

describe("validateKitIntegrity", () => {
  it("passes a consistent kit", () => {
    expect(validateKitIntegrity(makeKit())).toEqual([]);
  });

  it("flags a question referencing a missing requirement", () => {
    const kit = makeKit();
    kit.questions[0].requirement_ids = ["rX"];
    expect(validateKitIntegrity(kit).some((p) => p.includes("rX"))).toBe(true);
  });

  it("flags a must-have not present in the schedule", () => {
    const kit = makeKit();
    kit.schedule.days[0].question_ids = []; // r1's only question dropped from schedule
    expect(validateKitIntegrity(kit).some((p) => p.includes("r1"))).toBe(true);
  });

  it("flags a schedule whose day count != days_available", () => {
    const kit = makeKit();
    kit.schedule.days_available = 3;
    expect(validateKitIntegrity(kit).some((p) => p.includes("expected 3"))).toBe(true);
  });
});

describe("publicKit", () => {
  it("strips internal builder state from questions and flashcards", () => {
    const stripped = publicKit(makeKit());
    expect("origin" in stripped.questions[0]).toBe(false);
    expect(KitSchema.safeParse(stripped).success).toBe(true);
  });
});
