"use client";

import { ArrowUpRight, Download, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ResultActions({ token, expiresAt, buyUrl, slug }: { token: string; expiresAt: number; buyUrl: string; slug: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    setLeft(expiresAt - Date.now());
    const t = setInterval(() => setLeft(expiresAt - Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const mins = left === null ? null : Math.max(0, Math.floor(left / 60000));
  const secs = left === null ? 0 : Math.max(0, Math.floor((left % 60000) / 1000));

  const share = async () => {
    try {
      const blob = await (await fetch(`/api/resultados/${token}`)).blob();
      const file = new File([blob], "minha-prova.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: buyUrl || undefined });
      else window.open(`https://wa.me/?text=${encodeURIComponent(`Olha a camisa que eu provei! ${buyUrl}`)}`, "_blank");
    } catch {
      /* cancelado */
    }
  };

  if (deleted) {
    return (
      <div className="mt-6 rounded-2xl bg-white p-5 text-center text-sm">
        Imagem apagada. <Link href="/#catalogo" className="font-semibold underline">Ver catálogo</Link>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <a href={`/api/resultados/${token}?baixar=1`} className="btn-primary">
          <Download className="h-4 w-4 text-gold" /> Baixar
        </a>
        <button onClick={share} className="btn-outline">
          <Share2 className="h-4 w-4" /> Compartilhar
        </button>
      </div>
      {buyUrl && (
        <a href={buyUrl} target="_blank" rel="noreferrer" className="btn-gold w-full">
          <ArrowUpRight className="h-4 w-4" /> Comprar esta camisa
        </a>
      )}
      {slug && (
        <Link href={`/provar/${slug}`} className="btn-ghost w-full">
          Provar no meu celular
        </Link>
      )}
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-xs text-muted">
        <span>
          Disponível por mais <strong className="tabular-nums text-ink">{mins === null ? "--:--" : `${mins}:${String(secs).padStart(2, "0")}`}</strong> min
        </span>
        <button
          onClick={async () => {
            await fetch(`/api/resultados/${token}`, { method: "DELETE" });
            setDeleted(true);
          }}
          className="inline-flex items-center gap-1 font-semibold text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" /> Apagar agora
        </button>
      </div>
    </div>
  );
}
