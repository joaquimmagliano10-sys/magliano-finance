/**
 * Converte medidas reais (altura + circunferências) em influências de morph
 * target para o manequim e a camiseta, e define o "avatar padrão" usado quando
 * a estimativa pela foto falha.
 */
import { typicalChestForSize } from "../sizes";
import {
  BASE_BODY,
  BASE_FOLGA,
  BODY_MORPHS,
  type BodyMeasurements,
  MEASURE_LIMITS,
  type MeasureKey,
  SHIRT_MORPHS,
  type Sexo,
} from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Fator de escala uniforme do modelo (o .glb é gerado na altura base). */
export function heightScale(m: BodyMeasurements): number {
  return m.altura / BASE_BODY[m.sexo].altura;
}

/**
 * Influências dos morphs. Como o modelo inteiro é escalado pela altura, as
 * larguras também crescem; por isso convertemos as medidas para o "referencial
 * da altura base" (m / escala) antes de comparar com o corpo base.
 */
export function morphWeights(m: BodyMeasurements, folga?: number): Record<string, number> {
  const base = BASE_BODY[m.sexo];
  const s = heightScale(m);
  const weights: Record<string, number> = {};
  for (const def of BODY_MORPHS) weights[def.name] = 0;
  for (const def of BODY_MORPHS) {
    const key = def.key as MeasureKey;
    const d = m[key] / s - base[key];
    if (Math.sign(d) === Math.sign(def.delta) && d !== 0) weights[def.name] = clamp(d / def.delta, 0, 1.25);
  }
  if (folga !== undefined) {
    const fd = folga / s - BASE_FOLGA[m.sexo];
    for (const def of SHIRT_MORPHS.filter((d) => d.key === "folga")) {
      weights[def.name] = Math.sign(fd) === Math.sign(def.delta) && fd !== 0 ? clamp(fd / def.delta, 0, 1.2) : 0;
    }
  }
  return weights;
}

export function clampMeasurements(m: BodyMeasurements): BodyMeasurements {
  return {
    sexo: m.sexo,
    altura: clamp(m.altura, ...MEASURE_LIMITS.altura),
    ombros: clamp(m.ombros, ...MEASURE_LIMITS.ombros),
    peito: clamp(m.peito, ...MEASURE_LIMITS.peito),
    cintura: clamp(m.cintura, ...MEASURE_LIMITS.cintura),
    quadril: clamp(m.quadril, ...MEASURE_LIMITS.quadril),
  };
}

/**
 * Avatar padrão para um tamanho: parte do corpo base e ajusta o peito ao que
 * normalmente veste aquele tamanho; as demais medidas acompanham na mesma proporção.
 */
export function defaultBodyForSize(sexo: Sexo, size: string, altura?: number): BodyMeasurements {
  const base = BASE_BODY[sexo];
  const h = altura ?? base.altura;
  const s = h / base.altura;
  const chest = typicalChestForSize(sexo, size);
  const k = chest / (base.peito * s);
  return clampMeasurements({
    sexo,
    altura: h,
    peito: chest,
    ombros: base.ombros * s * (1 + (k - 1) * 0.45),
    cintura: base.cintura * s * (1 + (k - 1) * 1.3),
    quadril: base.quadril * s * (1 + (k - 1) * 0.8),
  });
}
