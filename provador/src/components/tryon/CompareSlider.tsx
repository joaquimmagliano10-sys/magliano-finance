"use client";

import { MoveHorizontal } from "lucide-react";
import { useCallback, useRef, useState } from "react";

/** Antes × depois: arraste a barra para comparar a foto original com a prova. */
export function CompareSlider({ before, after, className = "" }: { before: string; after: string; className?: string }) {
  const [pos, setPos] = useState(0.5);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const update = useCallback((clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  }, []);
  return (
    <div
      ref={ref}
      className={`relative touch-none overflow-hidden rounded-[var(--radius-xl2)] bg-ink select-none ${className}`}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      role="slider"
      aria-label="Comparar antes e depois"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos * 100)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 0.05));
        if (e.key === "ArrowRight") setPos((p) => Math.min(1, p + 0.05));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="Com a camisa" className="block h-full w-full object-contain" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="Foto original" className="block h-full w-full object-contain" draggable={false} />
      </div>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos * 100}%` }}>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white shadow" />
        <div className="absolute top-1/2 -left-5 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-lg">
          <MoveHorizontal className="h-5 w-5" />
        </div>
      </div>
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">Antes</span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">Depois</span>
    </div>
  );
}
