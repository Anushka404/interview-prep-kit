"use client";

import { cn } from "@/lib/utils";
import type { Kit } from "@/lib/schema";

type Practice = Record<string, { confidence: number; at: string }>;

// Difficulty tints the bubble (sequential, one hue, three distinct lightness steps —
// not just opacity, so easy/med/hard read apart at a glance) — the number stays crisp.
const DIFF_STYLE: Record<number, string> = {
  1: "bg-diff-easy text-diff-easy-foreground",
  2: "bg-diff-med text-diff-med-foreground",
  3: "bg-diff-hard text-diff-hard-foreground",
};

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

  const COL = `minmax(260px, 380px) repeat(${questions.length}, 46px) 128px`;

  return (
    <div className="space-y-10">
      {/* headline */}
      <div className="flex flex-wrap gap-4">
        <Stat value={`${coveredMusts.length}/${musts.length}`} label="must-haves covered" tone={gaps.length ? "bad" : "good"} />
        <Stat value={String(questions.length)} label="questions" />
        <Stat value={String(shaky.length)} label="weak from practice" tone={shaky.length ? "warn" : "good"} />
      </div>

      {/* matrix */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Coverage map</h3>
          <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-diff-easy" /> easy</span>
            <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-diff-med" /> med</span>
            <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-diff-hard" /> hard</span>
          </div>
        </div>

        {/* w-fit: the box hugs the table's actual content width instead of stretching to
            fill the section — a 6-column table shouldn't leave dead space inside a border
            just because the page is wide. overflow-x-auto still scrolls on narrow screens. */}
        <div className="w-fit max-w-full overflow-x-auto rounded-xl border border-border">
          <div style={{ display: "grid", gridTemplateColumns: COL }}>
            {/* header row */}
            <Cell header sticky>Requirement</Cell>
            {questions.map((q, i) => (
              <Cell key={q.id} header center dense title={`${q.category} · difficulty ${q.difficulty}\n${q.prompt}`}>
                <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
              </Cell>
            ))}
            <Cell header center>Confidence</Cell>

            {/* requirement rows */}
            {reqs.map((r) => {
              const isGap = r.priority === "must" && countForReq(r.id) === 0;
              const conf = confidenceBucket(reqConfidence(r.id));
              return (
                <Row key={r.id}>
                  <Cell sticky className={cn("items-start gap-2.5", isGap && "border-l-2 border-l-destructive")}>
                    <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs", r.priority === "must" ? "bg-brand-muted text-brand" : "bg-muted text-muted-foreground")}>
                      {r.priority}
                    </span>
                    <span className="whitespace-normal break-words">{r.text}</span>
                    {isGap && <span className="ml-auto shrink-0 font-mono text-xs text-destructive">gap</span>}
                  </Cell>
                  {questions.map((q, qi) => {
                    const on = coversReq(qi, r.id);
                    return (
                      <Cell key={q.id} center dense title={on ? `q${qi + 1} covers this · difficulty ${q.difficulty}` : "not covered"}>
                        {on ? (
                          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", DIFF_STYLE[q.difficulty])}>
                            {q.difficulty}
                          </span>
                        ) : (
                          <span className="size-2 rounded-full border border-border" />
                        )}
                      </Cell>
                    );
                  })}
                  <Cell center>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", conf.cls)}>{conf.label}</span>
                  </Cell>
                </Row>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Rows are requirements (must-haves first). Each cell shows a covering question, shaded by its difficulty.
          Confidence comes from your flashcard practice.
        </p>
      </section>

      {/* weak spots */}
      <section>
        <h3 className="mb-4 text-lg font-semibold">Where to focus</h3>
        {gaps.length === 0 && shaky.length === 0 ? (
          <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Every must-have has a question and nothing is shaky yet. Practise the deck to surface weak spots.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {gaps.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-destructive/20 text-sm text-destructive">!</span>
                <span>{r.text}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-destructive">no question — regenerate this category</span>
              </li>
            ))}
            {shaky.map((r) => {
              const c = confidenceBucket(reqConfidence(r.id));
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3.5">
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", c.cls)}>{c.label}</span>
                  <span>{r.text}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">practise its flashcards</span>
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
  return <div className="col-span-full grid grid-cols-subgrid border-t border-border transition-colors hover:bg-card/30">{children}</div>;
}

function Cell({ children, header, center, sticky, dense, className, title }: {
  children?: React.ReactNode; header?: boolean; center?: boolean; sticky?: boolean; dense?: boolean; className?: string; title?: string;
}) {
  return (
    <div
      title={title}
      className={cn(
        "flex items-center py-3.5 text-sm",
        dense ? "px-1" : "px-4",
        center && "justify-center",
        header && "py-3 font-medium text-muted-foreground",
        header && !sticky && "bg-card/60",
        sticky && "sticky left-0 border-r border-border",
        sticky && (header ? "z-20 bg-card" : "z-10 bg-background"),
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
    <div className="rounded-xl border border-border bg-card/40 px-5 py-4">
      <span className={cn("text-3xl font-semibold tracking-tight", toneCls)}>{value}</span>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
