import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { collections, type KitDoc } from "@/lib/db";
import { runPipeline, type PipelineInput } from "@/lib/pipeline/orchestrator";

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
    const kit = await runPipeline(claimed.input, async (e) => {
      await kits.updateOne(
        { _id },
        { $push: { progress: { ...e, at: new Date() } }, $set: { updatedAt: new Date() } },
      );
    });
    await kits.updateOne(
      { _id },
      { $set: { status: "done", kit, error: null, updatedAt: new Date() } },
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
