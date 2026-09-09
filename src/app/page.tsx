"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const STEPS = [
  { k: "01", t: "Paste & point", d: "Drop in the job description and the company URL. Nothing to configure." },
  { k: "02", t: "It researches", d: "Crawls the company, finds how they hire, reads the role requirement by requirement." },
  { k: "03", t: "You practise", d: "A question bank tied to every requirement, flashcards, and a day-by-day plan." },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export default function Landing() {
  return (
    <main className="relative flex-1 overflow-hidden bg-background">
      {/* Static ambient: one restrained brand glow + hairline grid. No animation. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[-18%] h-[520px] w-[880px] -translate-x-1/2 rounded-full bg-brand/25 opacity-40 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.14] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklch, var(--foreground) 100%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 100%, transparent) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-mono text-sm font-semibold tracking-tight">
          Prep<span className="text-brand">Kit</span>
        </span>
        <Link href="/login">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pt-12 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        {/* Left: copy */}
        <div>
          <motion.span
            {...fade(0)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground backdrop-blur"
          >
            <span className="size-1.5 rounded-full bg-brand" /> AI Interview Prep Kit
          </motion.span>

          <motion.h1
            {...fade(0.06)}
            className="mt-6 text-balance text-5xl font-semibold leading-[1.02] tracking-tighter sm:text-6xl"
          >
            Know the{" "}
            <span className="bg-gradient-to-br from-brand to-brand/60 bg-clip-text text-transparent">interview</span>
            <br className="hidden sm:block" /> before you&apos;re in it.
          </motion.h1>

          <motion.p {...fade(0.12)} className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Paste a job description and a company URL. PrepKit researches how they hire, builds a
            question bank tied to every requirement, and lays out a plan you can practise against.
          </motion.p>

          <motion.div {...fade(0.18)} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="h-12 w-full bg-brand px-7 text-base text-brand-foreground hover:bg-brand/90 sm:w-auto">
                Build my kit →
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 w-full px-7 text-base sm:w-auto">
                I have an account
              </Button>
            </Link>
          </motion.div>

          <motion.p {...fade(0.24)} className="mt-6 font-mono text-xs text-muted-foreground">
            Free · crawls the real company site · deterministic schedule &amp; coverage
          </motion.p>
        </div>

        {/* Right: product preview — an honest mock of a generated kit */}
        <motion.div
          initial={{ opacity: 0, y: 20, rotateX: 6 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="[perspective:1200px]"
        >
          <KitPreview />
        </motion.div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.k}
            {...fade(0.3 + i * 0.08)}
            className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur"
          >
            <span className="font-mono text-xs text-brand">{s.k}</span>
            <h3 className="mt-3 text-base font-semibold tracking-tight">{s.t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </motion.div>
        ))}
      </section>
    </main>
  );
}

/* A miniature of the real kit UI — shows the product's actual output shape. */
function KitPreview() {
  return (
    <div className="rounded-2xl border border-border bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">prepkit / senior-frontend-engineer</span>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-sm font-semibold">Frontend Engineer</p>
          <p className="text-xs text-muted-foreground">Senior · Vercel</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="brand">must · React &amp; TypeScript</Chip>
            <Chip tone="brand">must · strong CSS</Chip>
            <Chip>nice · Next.js</Chip>
          </div>
        </div>

        {/* question card */}
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center justify-between">
            <span className="rounded bg-brand-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand">Technical</span>
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full bg-brand" />
              <span className="size-1.5 rounded-full bg-brand" />
              <span className="size-1.5 rounded-full bg-border" />
            </span>
          </div>
          <p className="mt-2.5 text-sm font-medium leading-snug">
            Build a <span className="text-brand">DeploymentStatusCard</span> that reflects build state in real time — how do you model the states?
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Strong answer: typed status enum, optimistic UI, and a fallback for the error state…
          </p>
        </div>

        {/* mini schedule */}
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">3-day plan</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { d: "Day 1", f: "Technical", m: 40 },
              { d: "Day 2", f: "System design", m: 40 },
              { d: "Day 3", f: "Behavioural", m: 30 },
            ].map((day) => (
              <div key={day.d} className="rounded-lg border border-border bg-background/60 p-2.5">
                <p className="text-[11px] font-medium">{day.d}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{day.f}</p>
                <p className="mt-1.5 font-mono text-[10px] text-brand">{day.m} min</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
          <span className="grid size-4 place-items-center rounded-full bg-emerald-500/25 text-[9px] text-emerald-400">✓</span>
          <span className="text-xs text-emerald-400">All must-haves covered</span>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "brand" }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] ${
        tone === "brand" ? "bg-brand-muted text-brand" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}
