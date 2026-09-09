import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { collections, type KitDoc } from "@/lib/db";
import { runPipeline, categoryFor, type PipelineInput } from "@/lib/pipeline/orchestrator";
import { KitSchema, type Kit, type Question } from "@/lib/schema";
import { buildSchedule } from "@/lib/pipeline/schedule";
import { findUncovered } from "@/lib/pipeline/coverage";
import { generateBrief } from "@/lib/pipeline/brief";
import { generateQuestionsForCategory } from "@/lib/pipeline/questions";

function dedupeHash(userId: string, input: PipelineInput): string {
  return createHash("sha256")
    .update(`${userId}\n${input.company_url}\n${input.jd}`)
    .digest("hex");
}

/**
 * Create a kit document (status "pending"). Deduplicates: submitting the same
 * JD + company again returns the existing kit rather than a duplicate (brief §10).
 */
export async function createKit(
  userId: string,
  input: PipelineInput,
): Promise<{ id: string; deduped: boolean }> {
  const { kits } = await collections();
  const hash = dedupeHash(userId, input);
  const existing = await kits.findOne({ userId, dedupeHash: hash });
  if (existing) return { id: String(existing._id), deduped: true };

  const now = new Date();
  const doc: KitDoc = {
    userId,
    status: "pending",
    dedupeHash: hash,
    input,
    kit: null,
    progress: [],
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  const res = await kits.insertOne(doc);
  return { id: String(res.insertedId), deduped: false };
}

/**
 * Run generation for a kit. Atomically claims the job (pending|failed → running)
 * so a double-trigger for the same kit never runs the pipeline twice (brief §13).
 * Progress is persisted step by step to power the live progress UI; failure is
 * recorded on the doc rather than thrown away.
 */
export async function generateKit(userId: string, kitId: string): Promise<KitDoc["status"]> {
  const { kits } = await collections();
  let _id: ObjectId;
  try {
    _id = new ObjectId(kitId);
  } catch {
    return "failed";
  }

  const claimed = await kits.findOneAndUpdate(
    { _id, userId, status: { $in: ["pending", "failed"] } },
    { $set: { status: "running", progress: [], error: null, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!claimed) {
    // Already running or done — return current status without re-running.
    const current = await kits.findOne({ _id, userId });
    return current?.status ?? "failed";
  }

  try {
    const { kit, research } = await runPipeline(claimed.input, async (e) => {
      await kits.updateOne(
        { _id },
        { $push: { progress: { ...e, at: new Date() } }, $set: { updatedAt: new Date() } },
      );
    });
    await kits.updateOne(
      { _id },
      { $set: { status: "done", kit, research, error: null, updatedAt: new Date() } },
    );
    return "done";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await kits.updateOne(
      { _id },
      { $set: { status: "failed", error: message, updatedAt: new Date() } },
    );
    return "failed";
  }
}

export async function getKitDoc(userId: string, kitId: string): Promise<KitDoc | null> {
  const { kits } = await collections();
  try {
    return await kits.findOne({ _id: new ObjectId(kitId), userId });
  } catch {
    return null;
  }
}

/** Prune schedule refs to deleted questions and recompute coverage (both deterministic). */
function healKit(kit: Kit): Kit {
  const qIds = new Set(kit.questions.map((q) => q.id));
  kit.schedule.days = kit.schedule.days.map((d) => ({
    ...d,
    question_ids: d.question_ids.filter((id) => qIds.has(id)),
  }));
  kit.coverage = {
    ...kit.coverage,
    uncovered_requirement_ids: findUncovered(kit.role.requirements, kit.questions),
  };
  return kit;
}

/** Persist a user-edited kit: validate shape, auto-heal, recompute coverage. */
export async function saveKitEdits(userId: string, kitId: string, incoming: unknown): Promise<Kit> {
  const parsed = KitSchema.safeParse(incoming);
  if (!parsed.success) throw new Error("Invalid kit: " + (parsed.error.issues[0]?.message ?? "bad shape"));
  const kit = healKit(parsed.data);
  const { kits } = await collections();
  const res = await kits.updateOne(
    { _id: new ObjectId(kitId), userId },
    { $set: { kit, updatedAt: new Date() } },
  );
  if (res.matchedCount === 0) throw new Error("Kit not found");
  return kit;
}

function nextQuestionIds(existing: Question[], count: number): string[] {
  let max = existing.reduce((m, q) => {
    const n = parseInt(q.id.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return Array.from({ length: count }, () => `q${++max}`);
}

/**
 * Regenerate one section without discarding edits elsewhere (brief §6).
 * For a question category, user-authored / edited / pinned questions in that
 * category are kept; only untouched generated ones are replaced. Other
 * categories, and hand-edits everywhere else, are never touched.
 */
export async function regenerateSection(userId: string, kitId: string, section: string): Promise<Kit> {
  const doc = await getKitDoc(userId, kitId);
  if (!doc || !doc.kit) throw new Error("Kit not found");
  const kit = doc.kit;
  const research = doc.research;

  if (section === "schedule") {
    kit.schedule = buildSchedule(kit.role.requirements, kit.questions, kit.schedule.days_available);
  } else if (section === "brief") {
    kit.company_brief = await generateBrief(
      {
        company: kit.source.company,
        crawledText: research?.crawledText ?? "",
        searchText: research?.searchText ?? "",
      },
      kit.company_brief.sources,
    );
  } else {
    const category = section as Question["category"];
    const reqs =
      category === "system-design"
        ? kit.role.requirements.filter((r) => r.kind === "technical")
        : kit.role.requirements.filter((r) => categoryFor(r.kind) === category);
    if (reqs.length === 0) throw new Error(`No requirements map to the ${category} category`);

    const kept = kit.questions.filter(
      (q) => q.category === category && (q.origin === "user" || q.edited || q.pinned),
    );
    const otherCategories = kit.questions.filter((q) => q.category !== category);

    const hiringContext = [research?.foundHiring ? research.crawledText : "", research?.searchText ?? ""]
      .filter(Boolean)
      .join("\n\n");
    const drafts = await generateQuestionsForCategory(category, reqs, {
      role: kit.role.title || "the role",
      seniority: kit.role.seniority || "mid-level",
      hiringContext,
    });
    const ids = nextQuestionIds(kit.questions, drafts.length);
    const fresh: Question[] = drafts.map((d, i) => ({
      id: ids[i],
      requirement_ids: d.requirement_ids,
      category: d.category,
      prompt: d.prompt,
      answer_outline: d.answer_outline,
      difficulty: Math.min(3, Math.max(1, Math.round(d.difficulty))),
      origin: "generated",
    }));
    kit.questions = [...otherCategories, ...kept, ...fresh];
  }

  return saveKitEdits(userId, kitId, kit);
}
