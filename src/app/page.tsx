"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FloatingPaths } from "@/components/floating-paths";
import { Button } from "@/components/ui/button";

const LINES = [
  ["Know", "the", "interview"],
  ["before", "you're", "in", "it."],
];

const STEPS = [
  { k: "01", t: "Paste & point", d: "Drop in the job description and the company URL. Nothing to configure." },
  { k: "02", t: "It researches", d: "Crawls the company, finds how they hire, and reads the role requirement by requirement." },
  { k: "03", t: "You practise", d: "A question bank tied to every requirement, flashcards, and a day-by-day plan." },
];

export default function Landing() {
  return (
    <main className="relative flex-1 overflow-hidden bg-background">
      <FloatingPaths />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-mono text-sm font-semibold tracking-tight">
          Prep<span className="text-brand">Kit</span>
        </span>
        <Link href="/login">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-20 pb-28 text-center sm:pt-28">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 rounded-full border border-border bg-card/60 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground backdrop-blur"
        >
          AI Interview Prep Kit
        </motion.span>

        <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tighter sm:text-7xl">
          {(() => {
            let n = 0; // running letter index so the reveal cascades across lines
            return LINES.map((words, li) => (
              <span key={li} className="block">
                {words.map((word, wi) => (
                  <span key={wi} className="mr-[0.28em] inline-block last:mr-0">
                    {word.split("").map((ch, ci) => (
                      <motion.span
                        key={`${li}-${wi}-${ci}`}
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: n++ * 0.025, type: "spring", stiffness: 150, damping: 24 }}
                        className={
                          word === "interview"
                            ? "inline-block bg-gradient-to-b from-brand to-brand/60 bg-clip-text text-transparent"
                            : "inline-block bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent"
                        }
                      >
                        {ch}
                      </motion.span>
                    ))}
                  </span>
                ))}
              </span>
            ));
          })()}
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-7 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg"
        >
          Paste a job description and a company URL. PrepKit researches how they hire, builds a
          question bank tied to every requirement, and lays out a plan you can practise against.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link href="/register">
            <Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90 h-12 px-7 text-base">
              Build my kit →
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-12 px-7 text-base backdrop-blur">
              I have an account
            </Button>
          </Link>
        </motion.div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.k}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 + i * 0.12, duration: 0.5 }}
            className="rounded-2xl border border-border bg-card/50 p-6 text-left backdrop-blur"
          >
            <span className="font-mono text-xs text-brand">{s.k}</span>
            <h3 className="mt-3 text-lg font-semibold tracking-tight">{s.t}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
          </motion.div>
        ))}
      </section>
    </main>
  );
}
