"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/lib/schema";

type Practice = Record<string, { confidence: number; at: string }>;

const RATINGS = [
  { v: 1, label: "Shaky", cls: "border-destructive/40 text-destructive hover:bg-destructive/10" },
  { v: 2, label: "Okay", cls: "border-amber-500/40 text-amber-400 hover:bg-amber-500/10" },
  { v: 3, label: "Solid", cls: "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" },
];

// Least-confident first: unseen (0) lead, then confidence ascending, oldest first.
function order(cards: Flashcard[], practice: Practice): Flashcard[] {
  return [...cards].sort((a, b) => {
    const ca = practice[a.id]?.confidence ?? 0;
    const cb = practice[b.id]?.confidence ?? 0;
    if (ca !== cb) return ca - cb;
    return (practice[a.id]?.at ?? "").localeCompare(practice[b.id]?.at ?? "");
  });
}

export function PracticeDeck({
  id, title, cards, initialPractice,
}: { id: string; title: string; cards: Flashcard[]; initialPractice: Practice }) {
  const [practice, setPractice] = useState<Practice>(initialPractice);
  const [session, setSession] = useState<Flashcard[]>(() => order(cards, initialPractice));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const card = session[index];
  const done = index >= session.length;

  const rate = useCallback(
    (confidence: number) => {
      if (!card) return;
      setPractice((p) => ({ ...p, [card.id]: { confidence, at: new Date().toISOString() } }));
      fetch(`/api/kits/${id}/practice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, confidence }),
      }).catch(() => {});
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [card, id],
  );

  const restart = (onlyWeak: boolean) => {
    const base = onlyWeak ? cards.filter((c) => (practice[c.id]?.confidence ?? 0) < 3) : cards;
    setSession(order(base.length ? base : cards, practice));
    setIndex(0);
    setRevealed(false);
  };

  // Keyboard: Space/Enter reveals; 1/2/3 rate once revealed.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || !card) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        rate(Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, card, rate]);

  const dist = useMemo(() => {
    const d = { 1: 0, 2: 0, 3: 0, unseen: 0 };
    for (const c of cards) {
      const conf = practice[c.id]?.confidence;
      if (conf === 1 || conf === 2 || conf === 3) d[conf] += 1;
      else d.unseen += 1;
    }
    return d;
  }, [cards, practice]);

  if (cards.length === 0) {
    return (
      <Empty id={id} message="This kit has no flashcards yet. Add some in the builder." />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="flex items-center justify-between">
        <Link href={`/kits/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Back to kit</Link>
        <span className="font-mono text-xs text-muted-foreground">{title}</span>
      </div>

      {!done ? (
        <>
          {/* progress */}
          <div className="mt-8">
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>Card {index + 1} of {session.length}</span>
              <span>{dist.unseen} unseen · {dist[1]} shaky</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-brand transition-all" style={{ width: `${(index / session.length) * 100}%` }} />
            </div>
          </div>

          {/* card stack */}
          <div className="relative mt-10 h-72" style={{ perspective: 1200 }}>
            {/* faux cards behind, for depth */}
            <div className="absolute inset-x-6 top-3 h-full rounded-2xl border border-border bg-card/30" />
            <div className="absolute inset-x-3 top-1.5 h-full rounded-2xl border border-border bg-card/40" />

            <AnimatePresence mode="wait">
              <motion.button
                key={card.id + String(revealed)}
                initial={{ opacity: 0, rotateX: revealed ? 90 : 0, y: revealed ? 0 : 12 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => !revealed && setRevealed(true)}
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center rounded-2xl border p-8 text-center",
                  revealed ? "border-brand/40 bg-card cursor-default" : "border-border bg-card cursor-pointer hover:border-brand/40",
                )}
                aria-live="polite"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {revealed ? "Answer" : "Prompt"}
                </span>
                <p className={cn("mt-3 text-pretty", revealed ? "text-base text-muted-foreground" : "text-xl font-medium")}>
                  {revealed ? card.back : card.front}
                </p>
                {!revealed && (
                  <span className="mt-6 font-mono text-xs text-muted-foreground">click or press space to reveal</span>
                )}
              </motion.button>
            </AnimatePresence>
          </div>

          {/* rating */}
          <div className="mt-10 h-12">
            {revealed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-3">
                {RATINGS.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => rate(r.v)}
                    className={cn("flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors", r.cls)}
                  >
                    {r.label}
                    <span className="font-mono text-xs opacity-60">{r.v}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </>
      ) : (
        <Summary id={id} dist={dist} total={cards.length} onAgain={() => restart(false)} onWeak={() => restart(true)} />
      )}
    </div>
  );
}

function Summary({
  id, dist, total, onAgain, onWeak,
}: { id: string; dist: { 1: number; 2: number; 3: number; unseen: number }; total: number; onAgain: () => void; onWeak: () => void }) {
  const solid = dist[3];
  const weak = dist[1] + dist[2];
  return (
    <div className="mt-16 rounded-2xl border border-border bg-card/40 p-8 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Session complete</h1>
      <p className="mt-1 text-sm text-muted-foreground">{solid} of {total} cards feel solid.</p>

      <div className="mx-auto mt-6 flex max-w-sm gap-1.5">
        <Bar n={dist[3]} total={total} cls="bg-emerald-500" label="Solid" />
        <Bar n={dist[2]} total={total} cls="bg-amber-500" label="Okay" />
        <Bar n={dist[1]} total={total} cls="bg-destructive" label="Shaky" />
        <Bar n={dist.unseen} total={total} cls="bg-muted-foreground/40" label="Unseen" />
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {weak > 0 && (
          <Button onClick={onWeak} className="bg-brand text-brand-foreground hover:bg-brand/90">
            Practise {weak} weak spot{weak > 1 ? "s" : ""} →
          </Button>
        )}
        <Button variant="outline" onClick={onAgain}>Practise all again</Button>
        <Link href={`/kits/${id}`}><Button variant="ghost">Back to kit</Button></Link>
      </div>
    </div>
  );
}

function Bar({ n, total, cls, label }: { n: number; total: number; cls: string; label: string }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div className="flex-1" title={`${label}: ${n}`}>
      <div className="h-16 w-full overflow-hidden rounded-lg bg-muted/40">
        <div className={cn("mt-auto w-full", cls)} style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-xs">{n}</p>
    </div>
  );
}

function Empty({ id, message }: { id: string; message: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <p className="text-muted-foreground">{message}</p>
      <Link href={`/kits/${id}`} className="mt-4 inline-block text-brand hover:underline">← Back to kit</Link>
    </div>
  );
}
