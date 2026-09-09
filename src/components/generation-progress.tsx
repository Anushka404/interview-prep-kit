"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ProgressStep } from "@/lib/db";

const STEPS: { key: string; label: string }[] = [
  { key: "extract", label: "Extracting requirements" },
  { key: "crawl", label: "Researching the company" },
  { key: "search", label: "Searching interview discussion" },
  { key: "brief", label: "Writing the company brief" },
  { key: "questions", label: "Generating questions" },
  { key: "coverage", label: "Checking coverage" },
  { key: "flashcards", label: "Building flashcards" },
  { key: "schedule", label: "Planning the schedule" },
];

type Status = "pending" | "running" | "done" | "failed";

function stateFor(key: string, progress: ProgressStep[]): "done" | "active" | "skip" | "error" | "todo" {
  const events = progress.filter((p) => p.step === key);
  if (events.some((e) => e.status === "done")) return "done";
  if (events.some((e) => e.status === "skip")) return "skip";
  if (events.some((e) => e.status === "error")) return "error";
  if (events.some((e) => e.status === "start")) return "active";
  return "todo";
}

export function GenerationProgress({
  id,
  initialStatus,
  initialProgress,
}: {
  id: string;
  initialStatus: Status;
  initialProgress: ProgressStep[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [progress, setProgress] = useState<ProgressStep[]>(initialProgress);
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  async function trigger() {
    setError(null);
    setStatus("running");
    // Fire-and-forget: this request runs the pipeline server-side; we watch via polling.
    fetch(`/api/kits/${id}/generate`, { method: "POST" }).catch(() => {});
  }

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    if (initialStatus === "pending" || initialStatus === "failed") trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "done") {
      router.refresh();
      return;
    }
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/kits/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setProgress(data.progress ?? []);
        setStatus(data.status);
        if (data.status === "failed") setError(data.error ?? "Generation failed");
        if (data.status === "done") clearInterval(timer);
      } catch {
        /* transient — keep polling */
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [id, status, router]);

  const failed = status === "failed";

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="text-xl font-semibold tracking-tight">
        {failed ? "Generation stopped" : "Building your kit…"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {failed ? "Something went wrong partway through." : "Researching the company and writing your prep kit. This takes a minute or two."}
      </p>

      <ul className="mt-8 space-y-1">
        {STEPS.map((s) => {
          const st = stateFor(s.key, progress);
          const detail = [...progress].reverse().find((p) => p.step === s.key)?.detail;
          return (
            <li key={s.key} className="flex items-center gap-3 rounded-lg px-3 py-2">
              <Dot state={st} />
              <span className={st === "todo" ? "text-muted-foreground" : ""}>{s.label}</span>
              {detail && st !== "todo" && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">{detail}</span>
              )}
            </li>
          );
        })}
      </ul>

      {failed && (
        <div className="mt-6 space-y-4">
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
          <Button onClick={trigger} className="bg-brand text-brand-foreground hover:bg-brand/90">
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

function Dot({ state }: { state: "done" | "active" | "skip" | "error" | "todo" }) {
  if (state === "done") return <span className="grid size-5 place-items-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">✓</span>;
  if (state === "error") return <span className="grid size-5 place-items-center rounded-full bg-destructive/20 text-xs text-destructive">!</span>;
  if (state === "skip") return <span className="grid size-5 place-items-center rounded-full bg-muted text-xs text-muted-foreground">–</span>;
  if (state === "active") return <span className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />;
  return <span className="size-5 rounded-full border border-border" />;
}
