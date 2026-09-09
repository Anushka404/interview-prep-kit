import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getKitDoc } from "@/lib/kit-service";
import { GenerationProgress } from "@/components/generation-progress";
import { KitView } from "@/components/kit-view";

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const doc = await getKitDoc(session!.userId, id);
  if (!doc) notFound();

  if (doc.status === "done" && doc.kit) {
    return <KitView id={id} kit={doc.kit} />;
  }
  return <GenerationProgress id={id} initialStatus={doc.status} initialProgress={doc.progress} />;
}
