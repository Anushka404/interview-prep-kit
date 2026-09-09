import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getKitDoc, saveKitEdits } from "@/lib/kit-service";
import { collections } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await getKitDoc(session.userId, id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: String(doc._id),
    status: doc.status,
    progress: doc.progress,
    kit: doc.kit,
    error: doc.error,
    input: doc.input,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.kit) return NextResponse.json({ error: "missing kit" }, { status: 400 });
  try {
    const kit = await saveKitEdits(session.userId, id, body.kit);
    return NextResponse.json({ kit });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "save failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { kits } = await collections();
  try {
    const res = await kits.deleteOne({ _id: new ObjectId(id), userId: session.userId });
    if (res.deletedCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
