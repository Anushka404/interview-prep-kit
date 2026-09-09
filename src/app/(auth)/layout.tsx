import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
      <Link href="/" className="mb-8 font-mono text-sm font-semibold tracking-tight">
        Prep<span className="text-brand">Kit</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/60 p-8 backdrop-blur">
        {children}
      </div>
    </main>
  );
}
