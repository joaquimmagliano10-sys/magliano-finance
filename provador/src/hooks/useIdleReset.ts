"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Inatividade do quiosque: após `warnAt` segundos sem toque mostra o aviso;
 * em `resetAt` segundos chama `onReset`. `paused` impede o reset (ex.: enquanto
 * a IA processa) e `enabled` desliga tudo (tela de atração).
 */
export function useIdleReset({ resetAt = 60, warnAt = 50, enabled, paused, onReset }: { resetAt?: number; warnAt?: number; enabled: boolean; paused: boolean; onReset: () => void }) {
  const last = useRef(Date.now());
  const [remaining, setRemaining] = useState<number | null>(null);
  const resetRef = useRef(onReset);
  resetRef.current = onReset;

  const poke = useCallback(() => {
    last.current = Date.now();
    setRemaining(null);
  }, []);

  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, poke, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, poke));
  }, [poke]);

  useEffect(() => {
    if (!enabled) {
      setRemaining(null);
      return;
    }
    poke();
    const t = setInterval(() => {
      if (paused) {
        last.current = Date.now();
        return;
      }
      const idle = (Date.now() - last.current) / 1000;
      if (idle >= resetAt) {
        setRemaining(null);
        last.current = Date.now();
        resetRef.current();
      } else if (idle >= warnAt) {
        setRemaining(Math.ceil(resetAt - idle));
      } else {
        setRemaining(null);
      }
    }, 250);
    return () => clearInterval(t);
  }, [enabled, paused, resetAt, warnAt, poke]);

  return { remaining, poke };
}
