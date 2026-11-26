"use client";

import { Hand, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ShirtTextureSpec } from "@/lib/client/shirt-texture";
import type { PublicShirt } from "@/lib/types";
import { LazyViewer360 } from "./three/LazyViewer";

/** Manequim 3D no topo da página, alternando entre as camisas do catálogo. */
export function HeroShowcase({ shirts }: { shirts: PublicShirt[] }) {
  const looks = useMemo(
    () => shirts.flatMap((s) => s.cores.slice(0, 2).map((c) => ({ shirt: s, color: c }))).slice(0, 6),
    [shirts],
  );
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || looks.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % looks.length), 4500);
    return () => clearInterval(t);
  }, [paused, looks.length]);
  const look = looks[i];
  const texture: ShirtTextureSpec | null = look
    ? {
        hex: look.color.hex,
        estampaFrente: look.shirt.estampaFrente,
        estampaCostas: look.shirt.estampaCostas,
        padrao: look.shirt.padrao,
        padraoEscala: look.shirt.padraoEscala,
        estampaLargura: look.shirt.estampaLargura,
        estampaPosicao: look.shirt.estampaPosicao,
      }
    : null;

  return (
    <div className="relative h-[420px] w-full sm:h-[560px]">
      <div className="absolute inset-x-6 top-10 bottom-6 rounded-[2.5rem] bg-gradient-to-b from-gold-soft/70 to-transparent" />
      <LazyViewer360
        className="h-full w-full"
        sexo="masculino"
        measurements={null}
        shirtChest={null}
        texture={texture}
        autoRotate
        onInteract={() => setPaused(true)}
      />
      {look && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold shadow-[var(--shadow-soft)] backdrop-blur">
          <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: look.color.hex }} />
          {look.shirt.nome} · {look.color.nome}
        </div>
      )}
      <div className="pointer-events-none absolute top-14 right-6 flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white">
        {paused ? <Hand className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />} Arraste para girar
      </div>
    </div>
  );
}
