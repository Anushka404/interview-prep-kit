import { MongoClient, type Db, type Collection, type ObjectId } from "mongodb";
import type { Kit } from "@/lib/schema";

/**
 * Mongo client as a cached singleton. Next.js hot-reloads modules in dev, which
 * would otherwise open a new pool on every change, so the promise is stashed on
 * globalThis. In production it's a normal module-level singleton.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function clientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see .env.example)");
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

let indexesReady = false;
async function ensureIndexes(db: Db) {
  if (indexesReady) return;
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("kits").createIndex({ userId: 1, updatedAt: -1 });
  await db.collection("kits").createIndex({ userId: 1, dedupeHash: 1 });
  indexesReady = true;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  const db = client.db(process.env.MONGODB_DB || "interview_prep_kit");
  await ensureIndexes(db);
  return db;
}

// Persisted shapes. A kit document is the Appendix-A Kit plus ownership + job state.
export interface UserDoc {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface ProgressStep {
  step: string;
  status: "start" | "done" | "skip" | "error";
  detail?: string;
  at: Date;
}

export interface KitDoc {
  _id?: ObjectId;
  userId: string;
  status: "pending" | "running" | "done" | "failed";
  dedupeHash: string;
  input: { jd: string; company_url: string; days: number };
  kit: Kit | null;
  /** Research captured at generation time so a section can be regenerated without re-crawling. */
  research?: { company: string; crawledText: string; searchText: string; foundHiring: boolean };
  /** Practice confidence per flashcard id (1 = shaky, 3 = solid). Drives session ordering + weak-spot map. */
  practice?: Record<string, { confidence: number; at: string }>;
  progress: ProgressStep[];
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function collections(): Promise<{
  users: Collection<UserDoc>;
  kits: Collection<KitDoc>;
}> {
  const db = await getDb();
  return { users: db.collection<UserDoc>("users"), kits: db.collection<KitDoc>("kits") };
}
