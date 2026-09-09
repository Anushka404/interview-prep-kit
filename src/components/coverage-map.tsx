"use client";

import { cn } from "@/lib/utils";
import type { Kit } from "@/lib/schema";

type Practice = Record<string, { confidence: number; at: string }>;

const DIFF_OPACITY: Record<number, string> = { 1: "opacity-40", 2: "opacity-70", 3: "opacity-100" };

// Practice confidence → reserved status (shipped with a text label, never colour alone).
function confidenceBucket(avg: number | null): { label: string; cls: string } {
  if (avg === null) return { label: "not practised", cls: "bg-muted text-muted-foreground" };
  if (avg < 1.7) return { label: "shaky", cls: "bg-destructive/15 text-destructive" };
  if (avg < 2.5) return { label: "okay", cls: "bg-amber-500/15 text-amber-400" };
  return { label: "solid", cls: "bg-emerald-500/15 text-emerald-400" };
}

export function CoverageMap({ kit, practice }: { kit: Kit; practice: Practice }) {
  const reqs = [...kit.role.requirements].sort((a, b) =>
    a.priority === b.priority ? 0 : a.priority === "must" ? -1 : 1,
  );
  const questions = kit.questions;

  const coversReq = (qi: number, reqId: string) => questions[qi]?.requirement_ids.includes(reqId);
  const countForReq = (reqId: string) => questions.filter((q) => q.requirement_ids.includes(reqId)).length;

  const reqConfidence = (reqId: string): number | null => {
    const vals = kit.flashcards
      .filter((f) => f.requirement_ids.includes(reqId))
      .map((f) => practice[f.id]?.confidence)
      .filter((c): c is number => typeof c === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const musts = reqs.filter((r) => r.priority === "must");
  const coveredMusts = musts.filter((r) => countForReq(r.id) > 0);
  const gaps = musts.filter((r) => countForReq(r.id) === 0);
  const shaky = reqs.filter((r) => {
    const c = reqConfidence(r.id);
    return c !== null && c < 2.5;
  });

  return (
    <div className="space-y-8">
      {/* headline */}
      <div className="flex flex-wrap gap-3">
        <Stat value={`${coveredMusts.length}/${musts.length}`} label="must-haves covered" tone={gaps.length ? "bad" : "good"} />
        <Stat value={String(questions.length)} label="questions" />
        <Stat value={String(shaky.length)} label="weak from practice" tone={shaky.length ? "warn" : "good"} />
      </div>

      {/* matrix */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Coverage map</h3>
          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-brand opacity-40" /> easy</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-brand opacity-70" /> med</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-brand" /> hard</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <div
            className="min-w-max"
            style={{ display: "grid", gridTemplateColumns: `minmax(200px,1.4fr) repeat(${questions.length}, 30px) 108px` }}
          >
            {/* header row */}
            <Cell header>Requirement</Cell>
            {questions.map((q, i) => (
              <Cell key={q.id} header center title={`${q.category} · difficulty ${q.difficulty}\n${q.prompt}`}>
                <span className="font-mono text-[10px] text-muted-foreground">{i + 1}</span>
              </Cell>
            ))}
            <Cell header center>Confidence</Cell>

            {/* requirement rows */}
            {reqs.map((r) => {
              const isGap = r.priority === "must" && countForReq(r.id) === 0;
              const conf = confidenceBucket(reqConfidence(r.id));
              return (
                <Row key={r.id}>
                  <Cell className={cn("gap-2", isGap && "border-l-2 border-l-destructive")}>
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px]", r.priority === "must" ? "bg-brand-muted text-brand" : "bg-muted text-muted-foreground")}>
                      {r.priority}
                    </span>
                    <span className="truncate text-sm" title={r.text}>{r.text}</span>
                    {isGap && <span className="ml-auto shrink-0 font-mono text-[10px] text-destructive">gap</span>}
                  </Cell>
                  {questions.map((q, qi) => {
                    const on = coversReq(qi, r.id);
                    return (
                      <Cell key={q.id} center title={on ? `q${qi + 1} covers this · difficulty ${q.difficulty}` : "not covered"}>
                        {on ? (
                          <span className={cn("grid size-5 place-items-center rounded-sm bg-brand text-[10px] font-medium text-brand-foreground", DIFF_OPACITY[q.difficulty])}>
                            {q.difficulty}
                          </span>
                        ) : (
                          <span className="size-2 rounded-full border border-border" />
                        )}
                      </Cell>
                    );
                  })}
                  <Cell center>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px]", conf.cls)}>{conf.label}</span>
                  </Cell>
                </Row>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Rows are requirements (must-haves first). Each cell shows a covering question, shaded by its difficulty.
          Confidence comes from your flashcard practice.
        </p>
      </section>

      {/* weak spots */}
      <section>
        <h3 className="mb-3 font-semibold">Where to focus</h3>
        {gaps.length === 0 && shaky.length === 0 ? (
          <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Every must-have has a question and nothing is shaky yet. Practise the deck to surface weak spots.
          </p>
        ) : (
          <ul className="space-y-2">
            {gaps.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-destructive/20 text-xs text-destructive">!</span>
                <span className="text-sm">{r.text}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-destructive">no question — regenerate this category</span>
              </li>
            ))}
            {shaky.map((r) => {
              const c = confidenceBucket(reqConfidence(r.id));
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3">
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px]", c.cls)}>{c.label}</span>
                  <span className="text-sm">{r.text}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">practise its flashcards</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="col-span-full grid grid-cols-subgrid border-t border-border transition-colors hover:bg-card/40">{children}</div>;
}

function Cell({ children, header, center, className, title }: {
  children?: React.ReactNode; header?: boolean; center?: boolean; className?: string; title?: string;
}) {
  return (
    <div
      title={title}
      className={cn(
        "flex items-center px-3 py-2.5",
        center && "justify-center",
        header && "bg-card/60 py-2 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "good" | "bad" | "warn" }) {
  const toneCls = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-400" : tone === "good" ? "text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
      <span className={cn("text-2xl font-semibold tracking-tight", toneCls)}>{value}</span>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
