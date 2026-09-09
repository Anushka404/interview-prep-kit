import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getKitDoc } from "@/lib/kit-service";
import { GenerationProgress } from "@/components/generation-progress";
import { KitBuilder } from "@/components/kit-builder";

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const doc = await getKitDoc(session!.userId, id);
  if (!doc) notFound();

  if (doc.status === "done" && doc.kit) {
    return <KitBuilder id={id} initialKit={doc.kit} practice={doc.practice ?? {}} />;
  }
  return <GenerationProgress id={id} initialStatus={doc.status} initialProgress={doc.progress} />;
}
