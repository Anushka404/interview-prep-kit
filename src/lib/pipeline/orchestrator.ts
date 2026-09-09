import { extractRequirements } from "./extract";
import { crawlSite, type CrawlResult } from "./crawl";
import { searchInterviewProcess } from "./search";
import { generateBrief } from "./brief";
import { generateQuestionsForCategory, type QuestionDraft, type CategoryContext } from "./questions";
import { generateFlashcards } from "./flashcards";
import { buildSchedule } from "./schedule";
import { findUncovered, uncoveredMust } from "./coverage";
import { validateKitIntegrity, type Kit, type Question, type Requirement, type Flashcard } from "@/lib/schema";

export interface PipelineInput {
  jd: string;
  company_url: string;
  days: number;
}

export type StepStatus = "start" | "done" | "skip" | "error";
export interface StepEvent {
  step: string;
  status: StepStatus;
  detail?: string;
}
export type OnStep = (e: StepEvent) => void | Promise<void>;

const MAX_PASSES = Number(process.env.COVERAGE_MAX_PASSES ?? 3);

// A requirement's natural question category.
function categoryFor(kind: Requirement["kind"]): "technical" | "behavioural" | "company-fit" {
  if (kind === "behavioural") return "behavioural";
  if (kind === "domain") return "company-fit";
  return "technical";
}

function looksSenior(seniority: string, title: string): boolean {
  return /senior|staff|lead|principal|architect|head|manager/i.test(`${seniority} ${title}`);
}

function companyFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] || host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "";
  }
}

export async function runPipeline(input: PipelineInput, onStep: OnStep = () => {}): Promise<Kit> {
  const emit = async (step: string, status: StepStatus, detail?: string) =>
    onStep({ step, status, detail });

  // ---- Step 1: extract requirements (fatal if this fails — no kit without it) ----
  await emit("extract", "start");
  const extraction = await extractRequirements(input.jd);
  await emit("extract", "done", `${extraction.requirements.length} requirements`);

  // ---- Steps 2-3: crawl the company site (soft — an unreachable site is still a kit) ----
  let crawl: CrawlResult | null = null;
  await emit("crawl", "start");
  try {
    crawl = await crawlSite(input.company_url);
    await emit("crawl", "done", `${crawl.pagesUsed.length} pages, hiring=${crawl.foundHiring}`);
  } catch (err) {
    await emit("crawl", "error", err instanceof Error ? err.message : String(err));
  }

  const company = companyFromUrl(input.company_url);
  const crawledText = crawl ? crawl.pages.map((p) => `# ${p.title}\n${p.text}`).join("\n\n") : "";

  // ---- Step 4: public interview discussion (soft — nothing found is valid) ----
  await emit("search", "start");
  const search = await searchInterviewProcess(company, extraction.title || "");
  await emit("search", search.text ? "done" : "skip", `${search.sources.length} sources`);

  // ---- Company brief (soft — honest fallback if nothing was found) ----
  await emit("brief", "start");
  let briefResult;
  try {
    const briefSources = [...(crawl?.pagesUsed ?? []), ...search.sources];
    briefResult = await generateBrief({ company, crawledText, searchText: search.text }, briefSources);
    await emit("brief", "done");
  } catch (err) {
    briefResult = {
      summary: `Limited information available for ${company}.`,
      what_they_do: "Could not be determined from available sources.",
      sources: [...(crawl?.pagesUsed ?? []), ...search.sources],
    };
    await emit("brief", "error", err instanceof Error ? err.message : String(err));
  }

  // ---- Step 5: generate questions per category (separate calls) ----
  const hiringContext = [crawl?.foundHiring ? crawledText : "", search.text].filter(Boolean).join("\n\n");
  const ctx: CategoryContext = {
    role: extraction.title || "the role",
    seniority: extraction.seniority || "mid-level",
    hiringContext,
  };

  const byCategory = new Map<"technical" | "behavioural" | "company-fit", Requirement[]>();
  for (const r of extraction.requirements) {
    const cat = categoryFor(r.kind);
    (byCategory.get(cat) ?? byCategory.set(cat, []).get(cat)!).push(r);
  }

  const drafts: QuestionDraft[] = [];
  await emit("questions", "start");
  for (const [cat, reqs] of byCategory) {
    const part = await generateQuestionsForCategory(cat, reqs, ctx);
    drafts.push(...part);
  }
  // System design pass for senior technical roles (a separate category call).
  const techReqs = byCategory.get("technical") ?? [];
  if (techReqs.length >= 2 && looksSenior(ctx.seniority, ctx.role)) {
    drafts.push(...(await generateQuestionsForCategory("system-design", techReqs, ctx)));
  }
  await emit("questions", "done", `${drafts.length} questions`);

  // Assign stable ids.
  let questions: Question[] = drafts.map((d, i) => ({
    id: `q${i + 1}`,
    requirement_ids: d.requirement_ids,
    category: d.category,
    prompt: d.prompt,
    answer_outline: d.answer_outline,
    difficulty: Math.min(3, Math.max(1, Math.round(d.difficulty))),
    origin: "generated" as const,
  }));

  // ---- Step 6 / The Second Pass: close must-have coverage gaps, re-check, cap passes ----
  let passes = 1;
  await emit("coverage", "start");
  while (passes < MAX_PASSES) {
    const gaps = uncoveredMust(extraction.requirements, questions);
    if (gaps.length === 0) break;
    await emit("coverage", "start", `pass ${passes + 1}: ${gaps.length} gaps`);
    const gapReqs = extraction.requirements.filter((r) => gaps.includes(r.id));
    const gapByCat = new Map<"technical" | "behavioural" | "company-fit", Requirement[]>();
    for (const r of gapReqs) (gapByCat.get(categoryFor(r.kind)) ?? gapByCat.set(categoryFor(r.kind), []).get(categoryFor(r.kind))!).push(r);
    for (const [cat, reqs] of gapByCat) {
      const extra = await generateQuestionsForCategory(cat, reqs, ctx);
      for (const d of extra) {
        questions.push({
          id: `q${questions.length + 1}`,
          requirement_ids: d.requirement_ids,
          category: d.category,
          prompt: d.prompt,
          answer_outline: d.answer_outline,
          difficulty: Math.min(3, Math.max(1, Math.round(d.difficulty))),
          origin: "generated",
        });
      }
    }
    passes += 1;
  }
  await emit("coverage", "done", `${passes} passes`);

  // ---- Flashcards ----
  await emit("flashcards", "start");
  let flashcards: Flashcard[];
  try {
    const fdrafts = await generateFlashcards(extraction.requirements, ctx.role);
    flashcards = fdrafts.map((f, i) => ({ id: `f${i + 1}`, ...f, origin: "generated" as const }));
    await emit("flashcards", "done", `${flashcards.length} cards`);
  } catch (err) {
    flashcards = [];
    await emit("flashcards", "error", err instanceof Error ? err.message : String(err));
  }

  // ---- Steps 7-8: deterministic schedule + final coverage (our code, not the model) ----
  await emit("schedule", "start");
  const schedule = buildSchedule(extraction.requirements, questions, input.days);
  const uncovered = findUncovered(extraction.requirements, questions);
  await emit("schedule", "done");

  const kit: Kit = {
    source: {
      company,
      company_url: input.company_url,
      role: extraction.title,
      location: extraction.location,
      jd_chars: input.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawl?.pagesUsed ?? [],
    },
    company_brief: briefResult,
    role: {
      title: extraction.title,
      seniority: extraction.seniority,
      responsibilities: extraction.responsibilities,
      requirements: extraction.requirements,
    },
    questions,
    flashcards,
    schedule,
    coverage: { uncovered_requirement_ids: uncovered, passes },
  };

  const problems = validateKitIntegrity(kit);
  if (problems.length) {
    // Structural bug in our own assembly — surface it rather than saving a bad kit.
    throw new Error(`generated kit failed integrity check: ${problems.join("; ")}`);
  }
  return kit;
}
