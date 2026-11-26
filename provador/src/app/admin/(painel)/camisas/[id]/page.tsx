import { notFound } from "next/navigation";
import { ShirtForm } from "@/components/admin/ShirtForm";
import { repo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditarCamisaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shirt = await repo().getShirt(id);
  if (!shirt) notFound();
  return (
    <div>
      <p className="eyebrow">Catálogo</p>
      <h1 className="mt-1 mb-6 font-display text-3xl font-bold">Editar {shirt.nome}</h1>
      <ShirtForm shirt={shirt} />
    </div>
  );
}
