import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { collections } from "@/lib/db";

const Body = z.object({
  cardId: z.string().min(1),
  confidence: z.number().int().min(1).max(3),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { kits } = await collections();
  try {
    const res = await kits.updateOne(
      { _id: new ObjectId(id), userId: session.userId },
      {
        $set: {
          [`practice.${parsed.data.cardId}`]: { confidence: parsed.data.confidence, at: new Date().toISOString() },
          updatedAt: new Date(),
        },
      },
    );
    if (res.matchedCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
