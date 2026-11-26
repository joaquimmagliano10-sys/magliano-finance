"use client";

import { useCallback, useState } from "react";
import { BRAND } from "@/lib/brand";
import { downloadBlob } from "@/lib/client/images";
import { STATIC_DEMO } from "@/lib/client/runtime";
import { buildShareCard } from "@/lib/client/share-card";
import type { PublicShirt } from "@/lib/types";
import { resultKey, useProvador } from "@/store/provador";

/** Baixar e compartilhar a imagem da prova (foto com IA ou, se não houver, o 360°). */
export function useShareActions(shirt: PublicShirt, snapshot: () => string | null) {
  const [busy, setBusy] = useState(false);
  const colorId = useProvador((s) => s.colorId) ?? shirt.cores[0]?.id;
  const color = shirt.cores.find((c) => c.id === colorId) ?? shirt.cores[0];

  const currentImage = useCallback((): { src: string; selo?: string } | null => {
    const r = useProvador.getState().results[resultKey(shirt.id, color?.id ?? "")];
    if (r?.status === "pronto" && r.image) return { src: r.image, selo: r.mode === "demo" ? "Prévia simulada" : "Prova virtual · IA" };
    const shot = snapshot();
    return shot ? { src: shot, selo: "Avatar 3D · aproximação" } : null;
  }, [shirt.id, color?.id, snapshot]);

  const card = useCallback(async () => {
    const img = currentImage();
    if (!img) return null;
    return buildShareCard({ image: img.src, nome: shirt.nome, cor: color?.nome ?? "", preco: shirt.preco, selo: img.selo });
  }, [currentImage, shirt, color]);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await card();
      if (!blob) return;
      const filename = `${shirt.slug}-${color?.id ?? "prova"}.jpg`;
      if (STATIC_DEMO) {
        // dentro do claude.ai o download passa pela capacidade "downloads"
        const claude = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: Blob }) => Promise<unknown> } | null> } }).claude;
        const downloads = await claude?.use("downloads").catch(() => null);
        if (downloads) await downloads.save({ filename, data: blob }).catch(() => undefined);
        else downloadBlob(blob, filename);
        return;
      }
      downloadBlob(blob, filename);
    } finally {
      setBusy(false);
    }
  }, [card, shirt.slug, color?.id]);

  const shareWhatsApp = useCallback(async () => {
    const text = `Olha a ${shirt.nome} (${color?.nome}) que eu provei no provador virtual da ${BRAND.nome}!${shirt.linkCompra ? ` ${shirt.linkCompra}` : ""}`;
    if (STATIC_DEMO) {
      // a página de demonstração só pode abrir sites externos por um link de verdade
      const a = document.createElement("a");
      a.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    setBusy(true);
    try {
      const blob = await card();
      if (blob && typeof navigator !== "undefined" && "canShare" in navigator) {
        const file = new File([blob], `${shirt.slug}.jpg`, { type: "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }, [card, shirt, color]);

  return { download, shareWhatsApp, busy, card };
}
