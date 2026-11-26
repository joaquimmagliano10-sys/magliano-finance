"use client";

import { create } from "zustand";
import type { EstimateResult } from "@/lib/body/estimate";
import type { BodyMeasurements, Sexo } from "@/lib/body/types";
import type { PoseAnalysis } from "@/lib/client/pose";

/**
 * Estado da sessão de prova — SOMENTE EM MEMÓRIA. Nada é gravado no aparelho
 * (sem localStorage/cookies); recarregar a página ou `reset()` apaga tudo.
 */
export interface PhotoState {
  url: string; // object URL
  blob: Blob;
  width: number;
  height: number;
}

export type ResultStatus = "enviando" | "processando" | "pronto" | "erro";
export interface TryOnResult {
  status: ResultStatus;
  image?: string;
  mode?: "ia" | "demo";
  error?: string;
  startedAt: number;
  provider?: string;
  /** token do link temporário (QR do modo loja) */
  shareToken?: string;
}

interface State {
  photo: PhotoState | null;
  pose: PoseAnalysis | null;
  poseStatus: "idle" | "analisando" | "ok" | "falhou";
  estimate: EstimateResult | null;
  sexo: Sexo;
  alturaCm: number | null;
  /** medidas usadas no avatar (estimadas, padrão do tamanho ou ajustadas à mão) */
  measurements: BodyMeasurements | null;
  measurementsSource: "foto" | "padrao" | "manual";
  shirtId: string | null;
  colorId: string | null;
  size: string | null;
  consent: boolean;
  results: Record<string, TryOnResult>;
  set: (p: Partial<State>) => void;
  setResult: (key: string, r: Partial<TryOnResult>) => void;
  reset: () => void;
}

const initial = {
  photo: null,
  pose: null,
  poseStatus: "idle" as const,
  estimate: null,
  sexo: "masculino" as Sexo,
  alturaCm: null,
  measurements: null,
  measurementsSource: "padrao" as const,
  shirtId: null,
  colorId: null,
  size: null,
  consent: false,
  results: {},
};

export const resultKey = (shirtId: string, colorId: string) => `${shirtId}:${colorId}`;

export const useProvador = create<State>((set, get) => ({
  ...initial,
  set: (p) => set(p),
  setResult: (key, r) =>
    set((s) => ({ results: { ...s.results, [key]: { ...(s.results[key] ?? { status: "enviando", startedAt: Date.now() }), ...r } } })),
  reset: () => {
    const { photo } = get();
    if (photo) URL.revokeObjectURL(photo.url);
    set({ ...initial, results: {} });
  },
}));
