"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewKitPage() {
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [busy, setBusy] = useState(false);

  async function submit(body: unknown) {
    setBusy(true);
    try {
      const res = await fetch("/api/kits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not create kit");
        return;
      }
      const ids: string[] = data.ids ?? [];
      if (ids.length === 1) router.push(`/kits/${ids[0]}`);
      else {
        toast.success(`Created ${ids.length} kits`);
        router.push("/kits");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  function onSingle(e: React.FormEvent) {
    e.preventDefault();
    submit({ jd, company_url: companyUrl, days });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const arr = Array.isArray(parsed) ? parsed : parsed.cases;
      const cases = (arr as { jd: string; company_url: string; days?: number }[]).map((c) => ({
        jd: c.jd,
        company_url: c.company_url,
        days: c.days ?? 5,
      }));
      if (!cases.length) return toast.error("File has no cases");
      await submit({ cases });
    } catch {
      toast.error("Could not parse file — expected JSON array of { jd, company_url, days }");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/kits" className="text-sm text-muted-foreground hover:text-foreground">← Back to kits</Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New prep kit</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste the job description and the company site. PrepKit does the research.
      </p>

      <form onSubmit={onSingle} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="jd">Job description</Label>
          <Textarea
            id="jd"
            required
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description here…"
            className="min-h-56 resize-y"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_140px]">
          <div className="space-y-2">
            <Label htmlFor="url">Company website</Label>
            <Input
              id="url"
              type="url"
              required
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="days">Days until interview</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={60}
              required
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {busy ? "Creating…" : "Generate kit"}
          </Button>
          <span className="text-sm text-muted-foreground">or</span>
          <label className="cursor-pointer text-sm text-brand hover:underline">
            upload a file of role/company pairs
            <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} disabled={busy} />
          </label>
        </div>
      </form>
    </div>
  );
}
