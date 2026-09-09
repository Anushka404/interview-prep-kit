"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Kit, Question } from "@/lib/schema";

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System design",
  "company-fit": "Company fit",
};

export function KitView({ id, kit }: { id: string; kit: Kit }) {
  const musts = kit.role.requirements.filter((r) => r.priority === "must");
  const uncoveredMusts = musts.filter((r) => kit.coverage.uncovered_requirement_ids.includes(r.id));
  const reqText = (rid: string) => kit.role.requirements.find((r) => r.id === rid)?.text ?? rid;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/kits" className="text-sm text-muted-foreground hover:text-foreground">← All kits</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{kit.role.title || "Prep kit"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[kit.role.seniority, kit.source.company].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link href={`/kits/${id}/practice`}>
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90">Practice →</Button>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">{kit.role.requirements.length} requirements</Badge>
        <Badge variant="secondary">{kit.questions.length} questions</Badge>
        <Badge variant="secondary">{kit.flashcards.length} flashcards</Badge>
        <Badge variant="secondary">{kit.schedule.days_available}-day plan</Badge>
        <Badge className={uncoveredMusts.length ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-400"} variant="secondary">
          {uncoveredMusts.length ? `${uncoveredMusts.length} must-have gap${uncoveredMusts.length > 1 ? "s" : ""}` : "All must-haves covered"}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-8 pt-6">
          <section className="rounded-2xl border border-border bg-card/40 p-6">
            <h2 className="font-semibold">About {kit.source.company}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{kit.company_brief.summary}</p>
            <p className="mt-3 text-sm">{kit.company_brief.what_they_do}</p>
            {kit.company_brief.sources.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Sources: {kit.company_brief.sources.slice(0, 5).map((s, i) => (
                  <a key={i} href={s} target="_blank" rel="noreferrer" className="mr-2 text-brand hover:underline">
                    {new URL(s).pathname || "/"}
                  </a>
                ))}
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-semibold">Requirements</h2>
            <ul className="space-y-2">
              {kit.role.requirements.map((r) => (
                <li key={r.id} className="flex items-start gap-3 rounded-lg border border-border bg-card/30 px-4 py-3">
                  <Badge variant="secondary" className={r.priority === "must" ? "bg-brand-muted text-brand" : ""}>
                    {r.priority}
                  </Badge>
                  <span className="text-sm">{r.text}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{r.kind}</span>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        {/* Questions */}
        <TabsContent value="questions" className="space-y-4 pt-6">
          {kit.questions.map((q) => (
            <QuestionCard key={q.id} q={q} reqText={reqText} />
          ))}
        </TabsContent>

        {/* Flashcards */}
        <TabsContent value="flashcards" className="grid gap-3 pt-6 sm:grid-cols-2">
          {kit.flashcards.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card/40 p-4">
              <p className="font-medium">{f.front}</p>
              <p className="mt-2 text-sm text-muted-foreground">{f.back}</p>
            </div>
          ))}
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule" className="space-y-3 pt-6">
          {uncoveredMusts.length > 0 && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Uncovered must-haves: {uncoveredMusts.map((r) => r.text).join(", ")}
            </p>
          )}
          {kit.schedule.days.map((d) => (
            <div key={d.day} className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Day {d.day} · {d.focus}</span>
                <span className="font-mono text-xs text-muted-foreground">{d.minutes} min</span>
              </div>
              {d.question_ids.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {d.question_ids.length} question{d.question_ids.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuestionCard({ q, reqText }: { q: Question; reqText: (id: string) => string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <Badge variant="secondary" className="bg-brand-muted text-brand">{CATEGORY_LABEL[q.category] ?? q.category}</Badge>
        <div className="flex gap-1" title={`difficulty ${q.difficulty}/3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`size-1.5 rounded-full ${n <= q.difficulty ? "bg-brand" : "bg-border"}`} />
          ))}
        </div>
      </div>
      <p className="mt-3 font-medium">{q.prompt}</p>
      <p className="mt-2 text-sm text-muted-foreground">{q.answer_outline}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {q.requirement_ids.map((rid) => (
          <span key={rid} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground" title={reqText(rid)}>
            {reqText(rid).slice(0, 30)}
          </span>
        ))}
      </div>
    </div>
  );
}
