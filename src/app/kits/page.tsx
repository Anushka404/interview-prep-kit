import Link from "next/link";
import { getSession } from "@/lib/auth";
import { collections } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-brand-muted text-brand",
  done: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
};

export default async function KitsPage() {
  const session = await getSession();
  const { kits } = await collections();
  const docs = await kits
    .find({ userId: session!.userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your prep kits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {docs.length === 0 ? "Nothing here yet." : `${docs.length} kit${docs.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link href="/kits/new">
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90">+ New kit</Button>
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="text-lg font-medium">Build your first kit</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Paste a job description and a company URL, and PrepKit does the research.
          </p>
          <Link href="/kits/new" className="mt-6">
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">+ New kit</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => {
            const id = String(d._id);
            return (
              <Link
                key={id}
                href={`/kits/${id}`}
                className="group rounded-2xl border border-border bg-card/50 p-5 transition-colors hover:border-brand/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 font-medium tracking-tight">
                    {d.kit?.role.title || d.input.company_url || "Untitled kit"}
                  </h2>
                  <Badge className={STATUS_STYLE[d.status] ?? ""} variant="secondary">
                    {d.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.kit?.source.company || "—"}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  {new Date(d.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {d.kit ? ` · ${d.kit.role.requirements.length} reqs · ${d.kit.questions.length} qs` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
