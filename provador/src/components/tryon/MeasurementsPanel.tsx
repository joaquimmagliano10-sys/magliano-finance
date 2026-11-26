"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { clampMeasurements } from "@/lib/body/morphs";
import { type BodyMeasurements, MEASURE_LIMITS } from "@/lib/body/types";
import { useProvador } from "@/store/provador";

const FIELDS: Array<{ key: keyof Omit<BodyMeasurements, "sexo">; label: string }> = [
  { key: "altura", label: "Altura" },
  { key: "ombros", label: "Ombros (largura)" },
  { key: "peito", label: "Peito / busto" },
  { key: "cintura", label: "Cintura" },
  { key: "quadril", label: "Quadril" },
];

/** Ajuste manual das medidas do avatar (todas em cm). */
export function MeasurementsPanel({ dark = false }: { dark?: boolean }) {
  const m = useProvador((s) => s.measurements);
  const source = useProvador((s) => s.measurementsSource);
  const estimate = useProvador((s) => s.estimate);
  const set = useProvador((s) => s.set);
  const [open, setOpen] = useState(false);
  if (!m) return null;
  const sourceLabel =
    source === "foto"
      ? `Estimado pela foto · confiança ${Math.round((estimate?.confidence ?? 0) * 100)}%`
      : source === "manual"
        ? "Ajustado por você"
        : "Avatar padrão do tamanho escolhido";
  return (
    <div className={`rounded-2xl border ${dark ? "border-white/15 bg-white/5 text-white" : "border-line bg-white"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-gold" /> Medidas do avatar
        </span>
        <span className={`text-xs ${dark ? "text-white/60" : "text-muted"}`}>{sourceLabel}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-inherit px-4 pt-3 pb-4">
          {FIELDS.map(({ key, label }) => {
            const [lo, hi] = MEASURE_LIMITS[key];
            const v = m[key];
            return (
              <label key={key} className="block">
                <span className="flex justify-between text-xs font-semibold">
                  <span>{label}</span>
                  <span className="tabular-nums">{Math.round(v * 100)} cm</span>
                </span>
                <input
                  type="range"
                  min={Math.round(lo * 100)}
                  max={Math.round(hi * 100)}
                  value={Math.round(v * 100)}
                  onChange={(e) =>
                    set({ measurements: clampMeasurements({ ...m, [key]: Number(e.target.value) / 100 }), measurementsSource: "manual" })
                  }
                  className="mt-1 w-full accent-[#c7a96b]"
                />
              </label>
            );
          })}
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className={`text-[11px] leading-snug ${dark ? "text-white/50" : "text-muted"}`}>
              Estimativa aproximada: uma foto de frente não mostra a profundidade do corpo.
            </p>
            {source === "manual" && (
              <button
                onClick={() => set({ measurementsSource: estimate?.ok ? "foto" : "padrao", measurements: estimate?.ok ? estimate.measurements : m })}
                className="chip shrink-0"
              >
                <RotateCcw className="h-3 w-3" /> Restaurar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
