import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { regenerateSection } from "@/lib/kit-service";

// Brief/category regeneration calls the model; give it room.
export const maxDuration = 120;

const Body = z.object({
  section: z.enum(["brief", "schedule", "technical", "behavioural", "system-design", "company-fit"]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid section" }, { status: 400 });

  try {
    const kit = await regenerateSection(session.userId, id, parsed.data.section);
    return NextResponse.json({ kit });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "regenerate failed" }, { status: 400 });
  }
}
