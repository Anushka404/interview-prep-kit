import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getKitDoc } from "@/lib/kit-service";
import { PracticeDeck } from "@/components/practice-deck";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const doc = await getKitDoc(session!.userId, id);
  if (!doc) notFound();
  if (!doc.kit || doc.status !== "done") redirect(`/kits/${id}`);

  return (
    <PracticeDeck
      id={id}
      title={doc.kit.role.title || "Prep kit"}
      cards={doc.kit.flashcards}
      initialPractice={doc.practice ?? {}}
    />
  );
}
