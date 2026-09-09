import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createKit } from "@/lib/kit-service";

const One = z.object({
  jd: z.string().min(1, "Job description is required"),
  company_url: z.string().url("A valid company URL is required"),
  days: z.number().int().min(1).max(60),
});
const Body = z.union([One, z.object({ cases: z.array(One).min(1).max(25) })]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const cases = "cases" in parsed.data ? parsed.data.cases : [parsed.data];
  const results = [];
  for (const c of cases) {
    results.push(await createKit(session.userId, c));
  }
  return NextResponse.json({ ids: results.map((r) => r.id), results });
}
