import type { Question, Requirement, ScheduleDay } from "@/lib/schema";

/**
 * Schedule allocation is arithmetic and belongs in code, not a prompt (brief §3, §8).
 * Rules enforced here:
 *  - exactly `daysAvailable` days are produced (empty days allowed when material is thin)
 *  - harder / higher-priority material lands earlier, not the night before
 *  - every must-have requirement's question appears somewhere
 *  - durations are integer minutes
 */

const MINUTES_BY_DIFFICULTY: Record<number, number> = { 1: 15, 2: 25, 3: 40 };

function questionMinutes(q: Question): number {
  return MINUTES_BY_DIFFICULTY[q.difficulty] ?? 25;
}

const CATEGORY_FOCUS: Record<string, string> = {
  technical: "Technical deep-dive",
  "system-design": "System design",
  behavioural: "Behavioural & stories",
  "company-fit": "Company fit & motivation",
};

function focusForDay(questions: Question[]): string {
  if (questions.length === 0) return "Review & consolidate";
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return CATEGORY_FOCUS[top] ?? "Practice";
}

/** Rank a question: must-have first, then harder first, then stable by id. */
function rankQuestions(questions: Question[], requirements: Requirement[]): Question[] {
  const mustReq = new Set(requirements.filter((r) => r.priority === "must").map((r) => r.id));
  const isMust = (q: Question) => q.requirement_ids.some((r) => mustReq.has(r));
  return [...questions].sort((a, b) => {
    const am = isMust(a) ? 1 : 0;
    const bm = isMust(b) ? 1 : 0;
    if (am !== bm) return bm - am; // must-haves earlier
    if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty; // harder earlier
    return a.id.localeCompare(b.id);
  });
}

export function buildSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysAvailable: number,
): { days_available: number; days: ScheduleDay[] } {
  const days = Math.max(1, Math.floor(daysAvailable));
  const buckets: Question[][] = Array.from({ length: days }, () => []);

  const ranked = rankQuestions(questions, requirements);
  const totalMinutes = ranked.reduce((s, q) => s + questionMinutes(q), 0);
  const target = Math.max(1, Math.ceil(totalMinutes / days));

  // Greedy front-loaded fill: hard/must material lands in the earliest days.
  let day = 0;
  let dayMinutes = 0;
  for (const q of ranked) {
    buckets[day].push(q);
    dayMinutes += questionMinutes(q);
    // Advance once this day hits its target, but never past the last day so
    // every question is placed within the requested number of days.
    if (dayMinutes >= target && day < days - 1) {
      day += 1;
      dayMinutes = 0;
    }
  }

  const scheduleDays: ScheduleDay[] = buckets.map((qs, i) => ({
    day: i + 1,
    focus: focusForDay(qs),
    question_ids: qs.map((q) => q.id),
    minutes: qs.reduce((s, q) => s + questionMinutes(q), 0),
  }));

  return { days_available: days, days: scheduleDays };
}
