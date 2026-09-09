import { NextResponse } from "next/server";
import { z } from "zod";
import { collections } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const { users } = await collections();

  const user = await users.findOne({ email: email.toLowerCase() });
  // Same response whether the email is unknown or the password is wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  await createSession(String(user._id), user.email);
  return NextResponse.json({ ok: true });
}
