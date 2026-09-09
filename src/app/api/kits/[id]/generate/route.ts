import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateKit } from "@/lib/kit-service";

// Generation is long-running (~90s). Request the platform maximum; the client
// polls GET /api/kits/[id] for live progress while this runs.
// ponytail: single long invocation. If the deploy platform caps below one run's
// duration, split into a client-driven /advance step machine — the per-step
// progress persistence already in place supports resuming.
export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const status = await generateKit(session.userId, id);
  return NextResponse.json({ status });
}
