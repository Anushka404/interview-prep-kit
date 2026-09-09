import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function KitsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/kits" className="font-mono text-sm font-semibold tracking-tight">
            Prep<span className="text-brand">Kit</span>
          </Link>
          <div className="flex items-center gap-3">
            {session && <span className="hidden text-sm text-muted-foreground sm:inline">{session.email}</span>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
