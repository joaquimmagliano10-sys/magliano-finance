"use client";

import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { formatPrice } from "@/lib/format";
import type { PublicShirt } from "@/lib/types";

/** Gaveta para trocar de camisa sem tirar outra foto. */
export function ShirtPickerSheet({
  open,
  shirts,
  currentId,
  onPick,
  onClose,
  dark = false,
}: {
  open: boolean;
  shirts: PublicShirt[];
  currentId: string;
  onPick: (s: PublicShirt) => void;
  onClose: () => void;
  dark?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trocar camisa"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85dvh] w-full max-w-3xl animate-fade-up overflow-auto rounded-t-3xl p-5 sm:rounded-3xl ${dark ? "bg-ink text-white" : "bg-paper"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Trocar camisa</h2>
          <button onClick={onClose} className={`grid h-10 w-10 place-items-center rounded-full ${dark ? "bg-white/10" : "bg-black/5"}`} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shirts.map((s) => {
            const active = s.id === currentId;
            const img = s.cores[0]?.imagem || s.fotos[0];
            return (
              <button
                key={s.id}
                onClick={() => onPick(s)}
                className={`group overflow-hidden rounded-2xl border text-left transition ${active ? "border-gold ring-2 ring-gold" : dark ? "border-white/10 hover:border-white/40" : "border-line bg-white hover:border-ink"}`}
              >
                <div className="relative aspect-[5/6] bg-[#f4f2ee]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img && <img src={img} alt={s.nome} className="h-full w-full object-cover" />}
                  {active && (
                    <span className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-gold text-ink">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm leading-tight font-bold">{s.nome}</p>
                  <p className={`mt-1 text-xs ${dark ? "text-white/60" : "text-muted"}`}>{formatPrice(s.preco)}</p>
                  <div className="mt-2 flex gap-1">
                    {s.cores.map((c) => (
                      <span key={c.id} className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ background: c.hex }} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
