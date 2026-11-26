"use client";

import { AlertTriangle, Check, Info, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicShirt } from "@/lib/types";
import { resultKey, useProvador } from "@/store/provador";
import { CompareSlider } from "./CompareSlider";

const STEPS = ["Enviando a foto com segurança", "Analisando corpo e pose", "Vestindo a camisa com IA", "Ajustando caimento e luz"];

/** Painel da prova em foto: progresso, resultado (antes × depois) e erros. */
export function PhotoResultPanel({
  shirt,
  onGenerate,
  onDemo,
  className = "h-[64dvh] max-h-[560px] sm:h-[560px]",
}: {
  shirt: PublicShirt;
  onGenerate: () => void;
  onDemo: () => void;
  className?: string;
}) {
  const photo = useProvador((s) => s.photo);
  const colorId = useProvador((s) => s.colorId) ?? shirt.cores[0]?.id;
  const result = useProvador((s) => s.results[resultKey(shirt.id, colorId ?? "")]);
  const [now, setNow] = useState(() => Date.now());
  const busy = result?.status === "enviando" || result?.status === "processando";
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [busy]);
  if (!photo) return null;

  if (!result) {
    return (
      <div className={`relative overflow-hidden rounded-[var(--radius-xl2)] bg-ink ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="Sua foto" className="h-full w-full object-contain opacity-40" />
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="max-w-xs">
            <p className="font-display text-xl font-bold text-white">Ver esta camisa na sua foto?</p>
            <p className="mt-2 text-sm text-white/70">O 360° já mostra a troca. Para a foto, geramos uma nova prova com IA.</p>
            <button onClick={onGenerate} className="btn-gold mt-5">
              <Sparkles className="h-4 w-4" /> Gerar foto com esta camisa
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (busy) {
    const elapsed = Math.max(0, (now - result.startedAt) / 1000);
    const stepIdx = result.status === "enviando" ? 0 : Math.min(STEPS.length - 1, 1 + Math.floor(elapsed / 6));
    return (
      <div className={`relative overflow-hidden rounded-[var(--radius-xl2)] bg-ink ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="Sua foto" className="h-full w-full object-contain opacity-55 blur-[1px]" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-gold/20 to-gold/55" />
        </div>
        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-ink/85 p-4 text-white backdrop-blur">
          <div className="mb-3 flex items-center justify-between text-xs text-white/60">
            <span>{result.mode === "demo" ? "Prévia simulada" : (result.provider ?? "Prova com IA")}</span>
            <span className="tabular-nums">{elapsed.toFixed(0)} s</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {STEPS.map((s, i) => (
              <li key={s} className={`flex items-center gap-2 ${i > stepIdx ? "text-white/35" : ""}`}>
                {i < stepIdx ? (
                  <Check className="h-4 w-4 text-gold" />
                ) : i === stepIdx ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-gold" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-white/25" />
                )}
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-white/50">Costuma levar de 10 a 30 segundos. Enquanto isso, gire o avatar 360°.</p>
        </div>
      </div>
    );
  }

  if (result.status === "erro" || !result.image) {
    return (
      <div className={`grid place-items-center rounded-[var(--radius-xl2)] border border-line bg-white p-8 text-center ${className}`}>
        <div className="max-w-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-warn" />
          <p className="mt-3 font-display text-lg font-bold">Não deu certo desta vez</p>
          <p className="mt-2 text-sm text-muted">{result.error}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={onGenerate} className="btn-primary">
              <RefreshCw className="h-4 w-4" /> Tentar de novo
            </button>
            <button onClick={onDemo} className="btn-outline">
              <Wand2 className="h-4 w-4" /> Ver prévia simulada
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <CompareSlider before={photo.url} after={result.image} className={className} />
      <div className="mt-2 flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {result.mode === "demo" ? (
          <span>
            <strong className="text-ink">Prévia simulada</strong> (sem IA): recolorimos a sua roupa com a cor e a estampa da camisa.{" "}
            {result.error ?? "Configure uma API de try-on para o resultado realista."}
          </span>
        ) : (
          <span>Imagem gerada por IA — pode haver pequenas diferenças de cor, caimento e detalhes em relação à peça real.</span>
        )}
      </div>
    </div>
  );
}
