"use client";

import { Pause, Play, ZoomIn, ZoomOut } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { BASE_BODY } from "@/lib/body/types";
import { textureFor } from "@/lib/client/texture-spec";
import { evaluateFit, recommendSize, shirtChest, sortSizes } from "@/lib/sizes";
import type { PublicShirt } from "@/lib/types";
import { useProvador } from "@/store/provador";
import { LazyViewer360 } from "../three/LazyViewer";
import type { ViewerHandle, ViewName } from "../three/Viewer360";
import { MeasurementsPanel } from "./MeasurementsPanel";

const VIEWS: Array<{ v: ViewName; label: string }> = [
  { v: "frente", label: "Frente" },
  { v: "esquerda", label: "Lado" },
  { v: "costas", label: "Costas" },
];

const FIT_COLORS: Record<string, string> = {
  apertada: "bg-danger/10 text-danger",
  justa: "bg-warn/10 text-warn",
  ideal: "bg-ok/10 text-ok",
  solta: "bg-warn/10 text-warn",
  grande: "bg-danger/10 text-danger",
};

/** 360°: avatar + camiseta, troca de cor/tamanho instantânea (sem nova foto). */
export const Panel360 = forwardRef<ViewerHandle, { shirt: PublicShirt; dark?: boolean; viewerClassName?: string }>(function Panel360(
  { shirt, dark = false, viewerClassName = "h-[64dvh] max-h-[560px] sm:h-[560px]" },
  ref,
) {
  const viewer = useRef<ViewerHandle>(null);
  useImperativeHandle(ref, () => ({
    snapshot: () => viewer.current?.snapshot() ?? null,
    setView: (v) => viewer.current?.setView(v),
    zoom: (c) => viewer.current?.zoom(c),
  }));
  const sexo = useProvador((s) => s.sexo);
  const measurements = useProvador((s) => s.measurements);
  const source = useProvador((s) => s.measurementsSource);
  const colorId = useProvador((s) => s.colorId);
  const size = useProvador((s) => s.size);
  const set = useProvador((s) => s.set);
  const [auto, setAuto] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [view, setView] = useState<ViewName | null>(null);

  const m = measurements ?? BASE_BODY[sexo];
  const sizes = sortSizes(shirt.tamanhos);
  const chosen = size && sizes.includes(size) ? size : null;
  const garmentChest = chosen ? shirtChest(sexo, chosen, shirt.modelagem) : null;
  const fit = garmentChest ? evaluateFit(m.peito, garmentChest, shirt.modelagem) : null;
  const recommended = source !== "padrao" ? recommendSize(sexo, m.peito, sizes, shirt.modelagem) : null;
  const color = shirt.cores.find((c) => c.id === colorId) ?? shirt.cores[0];
  const muted = dark ? "text-white/60" : "text-muted";

  return (
    <div className="flex flex-col gap-4">
      <div className={`relative overflow-hidden rounded-[var(--radius-xl2)] ${dark ? "bg-gradient-to-b from-ink-3 to-ink" : "bg-gradient-to-b from-white to-[#ece8df]"}`}>
        <LazyViewer360
          ref={viewer}
          className={viewerClassName}
          sexo={sexo}
          measurements={measurements}
          shirtChest={garmentChest}
          texture={textureFor(shirt, color?.id)}
          autoRotate={auto}
          onInteract={() => setAuto(false)}
        />
        <div className="absolute top-3 left-3 flex gap-1 rounded-full bg-white/85 p-1 shadow-[var(--shadow-soft)] backdrop-blur">
          {VIEWS.map(({ v, label }) => (
            <button
              key={v}
              onClick={() => {
                setAuto(false);
                setView(v);
                viewer.current?.setView(v);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${view === v ? "bg-ink text-white" : "text-ink hover:bg-black/5"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            onClick={() => setAuto((a) => !a)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink shadow-[var(--shadow-soft)] backdrop-blur"
            aria-label={auto ? "Pausar giro" : "Girar automaticamente"}
          >
            {auto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={() => {
              setZoomed((z) => !z);
              viewer.current?.zoom(!zoomed);
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink shadow-[var(--shadow-soft)] backdrop-blur"
            aria-label={zoomed ? "Afastar" : "Aproximar"}
          >
            {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium whitespace-nowrap text-white">
          Arraste para girar · pinça ou roda para zoom
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <p className={`mb-2 text-xs font-semibold tracking-wide uppercase ${muted}`}>Cor · {color?.nome}</p>
          <div className="flex flex-wrap gap-2">
            {shirt.cores.map((c) => (
              <button
                key={c.id}
                onClick={() => set({ colorId: c.id })}
                className={`h-9 w-9 rounded-full border border-black/15 transition ${c.id === color?.id ? "ring-2 ring-gold ring-offset-2" : "hover:scale-110"} ${dark ? "ring-offset-ink" : ""}`}
                style={{ background: c.hex }}
                aria-label={c.nome}
                title={c.nome}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>Tamanho</p>
            {fit && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${FIT_COLORS[fit.level]}`}>{fit.label}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => set({ size: s })}
                className={`relative min-w-12 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                  s === chosen ? (dark ? "border-gold bg-gold text-ink" : "border-ink bg-ink text-white") : dark ? "border-white/20 text-white hover:border-white" : "border-line bg-white hover:border-ink"
                }`}
              >
                {s}
                {s === recommended && (
                  <span className="absolute -top-2 -right-2 rounded-full bg-gold px-1.5 py-0.5 text-[9px] leading-none font-bold text-ink">IDEAL</span>
                )}
              </button>
            ))}
          </div>
          {recommended && (
            <p className={`mt-2 text-xs ${muted}`}>
              Pela estimativa das suas medidas, sugerimos o <strong className={dark ? "text-white" : "text-ink"}>{recommended}</strong>. Mude o tamanho para ver o
              caimento no avatar.
            </p>
          )}
        </div>
        <MeasurementsPanel dark={dark} />
      </div>
    </div>
  );
});
