/**
 * Tabela de tamanhos e avaliação de caimento.
 *
 * As medidas são a circunferência do PEITO DA CAMISETA (2 × largura da peça
 * estendida, de axila a axila), em metros. Ajuste à sua grade real em
 * `SIZE_CHART` — o provador usa esses números para dizer se a peça fica justa,
 * regular ou ampla no avatar.
 */
import type { Sexo } from "./body/types";

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG", "G1", "G2", "G3"] as const;

export const SIZE_CHART: Record<Sexo, Record<string, number>> = {
  masculino: { PP: 0.94, P: 1.0, M: 1.06, G: 1.12, GG: 1.18, XGG: 1.26, G1: 1.32, G2: 1.4, G3: 1.48 },
  // baby look / modelagem feminina
  feminino: { PP: 0.84, P: 0.88, M: 0.92, G: 0.98, GG: 1.04, XGG: 1.1, G1: 1.16, G2: 1.24, G3: 1.32 },
};

export type Modelagem = "slim" | "regular" | "oversized";

/** Folga ideal (peça − corpo) por modelagem, em metros de circunferência. */
const IDEAL_EASE: Record<Modelagem, [number, number]> = {
  slim: [0.03, 0.07],
  regular: [0.06, 0.13],
  oversized: [0.16, 0.3],
};

/** Modelagem oversized é cortada maior: somamos este extra à tabela. */
const MODELAGEM_EXTRA: Record<Modelagem, number> = { slim: -0.02, regular: 0, oversized: 0.12 };

export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => {
    const i = (SIZE_ORDER as readonly string[]).indexOf(s.toUpperCase());
    return i === -1 ? 100 : i;
  };
  return [...sizes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function shirtChest(sexo: Sexo, size: string, modelagem: Modelagem = "regular"): number | null {
  const v = SIZE_CHART[sexo][size.toUpperCase()];
  return v === undefined ? null : v + MODELAGEM_EXTRA[modelagem];
}

export type FitLevel = "apertada" | "justa" | "ideal" | "solta" | "grande";

export interface FitResult {
  ease: number;
  level: FitLevel;
  label: string;
}

export function evaluateFit(bodyChest: number, garmentChest: number, modelagem: Modelagem = "regular"): FitResult {
  const ease = garmentChest - bodyChest;
  const [lo, hi] = IDEAL_EASE[modelagem];
  let level: FitLevel;
  if (ease < Math.min(0.02, lo - 0.02)) level = "apertada";
  else if (ease < lo) level = "justa";
  else if (ease <= hi) level = "ideal";
  else if (ease <= hi + 0.1) level = "solta";
  else level = "grande";
  const labels: Record<FitLevel, string> = {
    apertada: "Deve ficar apertada",
    justa: "Mais justa no corpo",
    ideal: "Caimento ideal",
    solta: "Mais solta",
    grande: "Provavelmente grande",
  };
  return { ease, level, label: labels[level] };
}

/** Menor tamanho disponível com folga dentro da faixa ideal (ou o mais próximo dela). */
export function recommendSize(
  sexo: Sexo,
  bodyChest: number,
  sizes: string[],
  modelagem: Modelagem = "regular",
): string | null {
  const [lo, hi] = IDEAL_EASE[modelagem];
  const target = (lo + hi) / 2;
  let best: { size: string; score: number } | null = null;
  for (const size of sortSizes(sizes)) {
    const g = shirtChest(sexo, size, modelagem);
    if (g === null) continue;
    const ease = g - bodyChest;
    // penaliza mais ficar apertado do que ficar folgado
    const score = ease < lo ? (lo - ease) * 3 + Math.abs(target - lo) : Math.abs(ease - target);
    if (!best || score < best.score) best = { size, score };
  }
  return best?.size ?? null;
}

/** Medidas típicas de corpo para cada tamanho — usadas no avatar padrão (quando a foto falha). */
export function typicalChestForSize(sexo: Sexo, size: string): number {
  const g = shirtChest(sexo, size) ?? SIZE_CHART[sexo].M;
  return g - (IDEAL_EASE.regular[0] + IDEAL_EASE.regular[1]) / 2;
}
