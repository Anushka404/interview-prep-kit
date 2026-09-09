import { NextResponse } from "next/server";
import { z } from "zod";
import { collections } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const { users } = await collections();

  try {
    const res = await users.insertOne({
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
    });
    await createSession(String(res.insertedId), email.toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Unique index on email → duplicate key
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
