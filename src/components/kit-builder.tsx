"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { findUncovered } from "@/lib/pipeline/coverage";
import type { Kit, Question, Flashcard } from "@/lib/schema";

type Category = Question["category"];
const CATEGORIES: Category[] = ["technical", "behavioural", "system-design", "company-fit"];
const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System design",
  "company-fit": "Company fit",
};

type SaveState = "saved" | "saving" | "error";

export function KitBuilder({ id, initialKit }: { id: string; initialKit: Kit }) {
  const [kit, setKit] = useState<Kit>(initialKit);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [regen, setRegen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(async (next: Kit) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/kits/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kit: next }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      setSaveState("error");
      toast.error("Couldn't save — retrying on next edit");
    }
  }, [id]);

  // Optimistic mutate + debounced autosave. Coverage is recomputed locally so the
  // badge stays live without a round-trip (server recomputes it authoritatively too).
  const mutate = useCallback(
    (producer: (draft: Kit) => void) => {
      setKit((prev) => {
        const next = structuredClone(prev);
        producer(next);
        next.coverage.uncovered_requirement_ids = findUncovered(next.role.requirements, next.questions);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => save(next), 800);
        return next;
      });
    },
    [save],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  async function regenerate(section: string) {
    setRegen(section);
    try {
      const res = await fetch(`/api/kits/${id}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKit(data.kit);
      setSaveState("saved");
      toast.success(`Regenerated ${section === "brief" ? "company brief" : section}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setRegen(null);
    }
  }

  const musts = kit.role.requirements.filter((r) => r.priority === "must");
  const uncoveredMusts = musts.filter((r) => kit.coverage.uncovered_requirement_ids.includes(r.id));

  // --- question ops ---
  const editQuestion = (qid: string, patch: Partial<Question>) =>
    mutate((k) => {
      const q = k.questions.find((x) => x.id === qid);
      if (q) Object.assign(q, patch, { edited: q.origin === "generated" ? true : q.edited });
    });
  const moveQuestion = (qid: string, dir: -1 | 1) =>
    mutate((k) => {
      const i = k.questions.findIndex((x) => x.id === qid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= k.questions.length) return;
      [k.questions[i], k.questions[j]] = [k.questions[j], k.questions[i]];
    });
  const deleteQuestion = (qid: string) => mutate((k) => { k.questions = k.questions.filter((x) => x.id !== qid); });
  const togglePin = (qid: string) =>
    mutate((k) => { const q = k.questions.find((x) => x.id === qid); if (q) q.pinned = !q.pinned; });
  const addQuestion = () =>
    mutate((k) => {
      const max = k.questions.reduce((m, q) => Math.max(m, parseInt(q.id.replace(/\D/g, ""), 10) || 0), 0);
      k.questions.push({
        id: `q${max + 1}`, requirement_ids: [], category: "technical",
        prompt: "New question", answer_outline: "", difficulty: 2, origin: "user",
      });
    });

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
        <div className="flex items-center gap-3">
          <SavePill state={saveState} />
          <RegenerateMenu regen={regen} onRegenerate={regenerate} />
          <Link href={`/kits/${id}/practice`}>
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">Practice →</Button>
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">{kit.questions.length} questions</Badge>
        <Badge variant="secondary">{kit.flashcards.length} flashcards</Badge>
        <Badge variant="secondary">{kit.schedule.days_available}-day plan</Badge>
        <Badge className={uncoveredMusts.length ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-400"} variant="secondary">
          {uncoveredMusts.length ? `${uncoveredMusts.length} must-have gap${uncoveredMusts.length > 1 ? "s" : ""}` : "All must-haves covered"}
        </Badge>
      </div>

      <Tabs defaultValue="questions" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-8 pt-6">
          <section className="rounded-2xl border border-border bg-card/40 p-6">
            <h2 className="mb-2 font-semibold">About {kit.source.company}</h2>
            <AutoText
              value={kit.company_brief.summary}
              onChange={(v) => mutate((k) => { k.company_brief.summary = v; })}
              className="text-sm text-muted-foreground"
            />
            <AutoText
              value={kit.company_brief.what_they_do}
              onChange={(v) => mutate((k) => { k.company_brief.what_they_do = v; })}
              className="mt-3 text-sm"
            />
          </section>

          <section>
            <h2 className="mb-3 font-semibold">Requirements</h2>
            <ul className="space-y-2">
              {kit.role.requirements.map((r) => (
                <li key={r.id} className="flex items-start gap-3 rounded-lg border border-border bg-card/30 px-4 py-3">
                  <button
                    onClick={() => mutate((k) => { const req = k.role.requirements.find((x) => x.id === r.id); if (req) req.priority = req.priority === "must" ? "nice" : "must"; })}
                    className={cn("shrink-0 rounded px-2 py-0.5 text-xs", r.priority === "must" ? "bg-brand-muted text-brand" : "bg-muted text-muted-foreground")}
                    title="Toggle must / nice"
                  >
                    {r.priority}
                  </button>
                  <AutoText
                    value={r.text}
                    onChange={(v) => mutate((k) => { const req = k.role.requirements.find((x) => x.id === r.id); if (req) req.text = v; })}
                    className="flex-1 text-sm"
                  />
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.kind}</span>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        {/* Questions */}
        <TabsContent value="questions" className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Edit inline · reorder · pin to protect from regeneration</p>
            <Button variant="outline" size="sm" onClick={addQuestion}>+ Add question</Button>
          </div>
          {kit.questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              q={q}
              first={i === 0}
              last={i === kit.questions.length - 1}
              reqText={(rid) => kit.role.requirements.find((r) => r.id === rid)?.text ?? rid}
              onEdit={(patch) => editQuestion(q.id, patch)}
              onMove={(dir) => moveQuestion(q.id, dir)}
              onDelete={() => deleteQuestion(q.id)}
              onPin={() => togglePin(q.id)}
            />
          ))}
        </TabsContent>

        {/* Flashcards */}
        <TabsContent value="flashcards" className="pt-6">
          <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => mutate((k) => {
              const max = k.flashcards.reduce((m, f) => Math.max(m, parseInt(f.id.replace(/\D/g, ""), 10) || 0), 0);
              k.flashcards.push({ id: `f${max + 1}`, front: "New card", back: "", requirement_ids: [], origin: "user" });
            })}>+ Add flashcard</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {kit.flashcards.map((f) => (
              <FlashcardEditor
                key={f.id}
                f={f}
                onEdit={(patch) => mutate((k) => { const c = k.flashcards.find((x) => x.id === f.id); if (c) Object.assign(c, patch, { edited: c.origin === "generated" ? true : c.edited }); })}
                onDelete={() => mutate((k) => { k.flashcards = k.flashcards.filter((x) => x.id !== f.id); })}
                onPin={() => mutate((k) => { const c = k.flashcards.find((x) => x.id === f.id); if (c) c.pinned = !c.pinned; })}
              />
            ))}
          </div>
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule" className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Allocated by priority and difficulty across {kit.schedule.days_available} days.</p>
            <Button variant="outline" size="sm" disabled={regen === "schedule"} onClick={() => regenerate("schedule")}>
              {regen === "schedule" ? "Rebuilding…" : "Rebuild schedule"}
            </Button>
          </div>
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
                <p className="mt-2 text-sm text-muted-foreground">{d.question_ids.length} question{d.question_ids.length > 1 ? "s" : ""}</p>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RegenerateMenu({ regen, onRegenerate }: { regen: string | null; onRegenerate: (s: string) => void }) {
  const busy = regen !== null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        className="inline-flex h-8 items-center rounded-md border border-border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
      >
        {busy ? `Regenerating ${regen}…` : "Regenerate ▾"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onRegenerate("brief")}>Company brief</DropdownMenuItem>
        <DropdownMenuSeparator />
        {CATEGORIES.map((c) => (
          <DropdownMenuItem key={c} onClick={() => onRegenerate(c)}>{CATEGORY_LABEL[c]} questions</DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onRegenerate("schedule")}>Schedule</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SavePill({ state }: { state: SaveState }) {
  const map = {
    saving: { t: "Saving…", c: "text-muted-foreground" },
    saved: { t: "Saved", c: "text-emerald-400" },
    error: { t: "Save failed", c: "text-destructive" },
  }[state];
  return <span className={cn("font-mono text-xs", map.c)}>{map.t}</span>;
}

function QuestionEditor({
  q, first, last, reqText, onEdit, onMove, onDelete, onPin,
}: {
  q: Question; first: boolean; last: boolean; reqText: (id: string) => string;
  onEdit: (patch: Partial<Question>) => void;
  onMove: (dir: -1 | 1) => void; onDelete: () => void; onPin: () => void;
}) {
  return (
    <div className={cn("rounded-xl border bg-card/40 p-5", q.pinned ? "border-brand/50" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={q.category}
          onChange={(e) => onEdit({ category: e.target.value as Category })}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          aria-label="Question category"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <select
          value={q.difficulty}
          onChange={(e) => onEdit({ difficulty: Number(e.target.value) })}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          aria-label="Difficulty"
        >
          <option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Hard</option>
        </select>
        {q.origin === "user" && <Badge variant="secondary" className="text-[10px]">yours</Badge>}
        {q.edited && q.origin === "generated" && <Badge variant="secondary" className="text-[10px]">edited</Badge>}

        <div className="ml-auto flex items-center gap-1">
          <IconBtn label="Move up" disabled={first} onClick={() => onMove(-1)}>↑</IconBtn>
          <IconBtn label="Move down" disabled={last} onClick={() => onMove(1)}>↓</IconBtn>
          <IconBtn label={q.pinned ? "Unpin" : "Pin (protect from regenerate)"} onClick={onPin} active={q.pinned}>⌾</IconBtn>
          <IconBtn label="Delete" onClick={onDelete}>✕</IconBtn>
        </div>
      </div>

      <AutoText value={q.prompt} onChange={(v) => onEdit({ prompt: v })} className="mt-3 font-medium" placeholder="Question prompt" />
      <AutoText value={q.answer_outline} onChange={(v) => onEdit({ answer_outline: v })} className="mt-2 text-sm text-muted-foreground" placeholder="Answer outline" />

      {q.requirement_ids.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {q.requirement_ids.map((rid) => (
            <span key={rid} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground" title={reqText(rid)}>
              {reqText(rid).slice(0, 30)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FlashcardEditor({
  f, onEdit, onDelete, onPin,
}: { f: Flashcard; onEdit: (patch: Partial<Flashcard>) => void; onDelete: () => void; onPin: () => void }) {
  return (
    <div className={cn("rounded-xl border bg-card/40 p-4", f.pinned ? "border-brand/50" : "border-border")}>
      <div className="mb-2 flex items-center justify-end gap-1">
        {f.origin === "user" && <Badge variant="secondary" className="mr-auto text-[10px]">yours</Badge>}
        <IconBtn label={f.pinned ? "Unpin" : "Pin"} onClick={onPin} active={f.pinned}>⌾</IconBtn>
        <IconBtn label="Delete" onClick={onDelete}>✕</IconBtn>
      </div>
      <AutoText value={f.front} onChange={(v) => onEdit({ front: v })} className="font-medium" placeholder="Front" />
      <AutoText value={f.back} onChange={(v) => onEdit({ back: v })} className="mt-2 text-sm text-muted-foreground" placeholder="Back" />
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, active }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-7 place-items-center rounded-md border border-transparent text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-30 disabled:hover:border-transparent",
        active && "text-brand",
      )}
    >
      {children}
    </button>
  );
}

/** Textarea that looks like text until focused and grows to fit its content. */
function AutoText({ value, onChange, className, placeholder }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={cn(
        "w-full resize-none rounded-md bg-transparent px-1 py-0.5 outline-none transition-colors focus:bg-background focus:ring-1 focus:ring-brand/50",
        className,
      )}
    />
  );
}
