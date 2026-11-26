import type { Metadata } from "next";
import Link from "next/link";
import { ResultActions } from "@/components/ResultActions";
import { repo } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getTempMeta } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sua prova", robots: { index: false, follow: false } };

/** Página aberta pelo QR code do modo loja: baixar a imagem no próprio celular. */
export default async function ResultadoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const meta = await getTempMeta(token);
  if (!meta) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Link expirado</h1>
        <p className="mt-3 text-muted">Por privacidade, as imagens do provador ficam disponíveis por pouco tempo e depois são apagadas.</p>
        <Link href="/#catalogo" className="btn-primary mt-8">
          Ver catálogo
        </Link>
      </div>
    );
  }
  const shirt = await repo().getShirt(meta.shirtId).catch(() => null);
  const src = `/api/resultados/${token}`;
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="eyebrow">Sua prova virtual</p>
      {shirt && (
        <h1 className="mt-1 font-display text-3xl font-bold">
          {shirt.nome} <span className="text-gold-2">{formatPrice(shirt.preco)}</span>
        </h1>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Sua prova" className="mt-5 w-full rounded-[var(--radius-xl2)] bg-ink shadow-[var(--shadow-lift)]" />
      <ResultActions token={token} expiresAt={meta.expiresAt} buyUrl={shirt?.linkCompra ?? ""} slug={shirt?.slug ?? ""} />
    </div>
  );
}
