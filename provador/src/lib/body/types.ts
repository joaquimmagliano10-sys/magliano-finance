/**
 * Tipos e constantes compartilhados entre o gerador de modelos 3D (script de build),
 * o visualizador 360° (navegador) e a estimativa de medidas (MediaPipe).
 *
 * Todas as medidas estão em METROS. Circunferências (peito, cintura, quadril) são
 * medidas "de fita métrica"; `ombros` é a largura biacromial/bideltoide (de um
 * ombro ao outro, por fora, vista de frente).
 */

export type Sexo = "masculino" | "feminino";

export interface BodyMeasurements {
  sexo: Sexo;
  altura: number;
  ombros: number;
  peito: number;
  cintura: number;
  quadril: number;
}

export type MeasureKey = "ombros" | "peito" | "cintura" | "quadril";

/** Corpo base de cada manequim (o .glb é gerado nessas medidas). */
export const BASE_BODY: Record<Sexo, BodyMeasurements> = {
  masculino: { sexo: "masculino", altura: 1.75, ombros: 0.46, peito: 0.98, cintura: 0.84, quadril: 0.98 },
  feminino: { sexo: "feminino", altura: 1.65, ombros: 0.4, peito: 0.9, cintura: 0.72, quadril: 0.98 },
};

/**
 * Folga (ease) base da camiseta: quanto a circunferência do peito da camiseta
 * excede a do corpo no modelo base. 8 cm ≈ caimento "regular" masculino.
 */
export const BASE_FOLGA: Record<Sexo, number> = { masculino: 0.08, feminino: 0.06 };

export interface MorphDef {
  name: string;
  key: MeasureKey | "folga";
  /** Variação (em metros) que corresponde à influência 1.0 do morph target. */
  delta: number;
}

/**
 * Morph targets. Usamos alvos separados para "mais" e "menos" porque o caimento
 * da camiseta é não linear (o tecido cai reto a partir do peito e só encosta na
 * barriga/quadril quando eles ficam maiores). Com alvos separados cada morph é
 * interpolado só no intervalo [0, 1], onde a aproximação linear não deixa o
 * corpo atravessar o tecido.
 */
export const BODY_MORPHS: MorphDef[] = [
  { name: "ombros_mais", key: "ombros", delta: 0.08 },
  { name: "ombros_menos", key: "ombros", delta: -0.06 },
  { name: "peito_mais", key: "peito", delta: 0.3 },
  { name: "peito_menos", key: "peito", delta: -0.14 },
  { name: "cintura_mais", key: "cintura", delta: 0.4 },
  { name: "cintura_menos", key: "cintura", delta: -0.14 },
  { name: "quadril_mais", key: "quadril", delta: 0.3 },
  { name: "quadril_menos", key: "quadril", delta: -0.14 },
];

export const SHIRT_MORPHS: MorphDef[] = [
  ...BODY_MORPHS,
  { name: "folga_mais", key: "folga", delta: 0.24 },
  { name: "folga_menos", key: "folga", delta: -0.07 },
];

/** Limites plausíveis (em metros, já na altura real) usados para sanear estimativas. */
export const MEASURE_LIMITS: Record<MeasureKey | "altura", [number, number]> = {
  altura: [1.4, 2.1],
  ombros: [0.32, 0.62],
  peito: [0.72, 1.45],
  cintura: [0.56, 1.5],
  quadril: [0.76, 1.45],
};

/** Layout de UV da camiseta base — o atlas representa 1,6 m × 1,6 m de tecido. */
export const UV_ATLAS_METERS = 1.6;
export const UV_LAYOUT = {
  front: { centerU: 0.4, minU: 0.02, maxU: 0.78 },
  back: { centerU: 1.2, minU: 0.82, maxU: 1.58 },
  /** v = PANEL_V0 + (y - yRef), em metros */
  panelV0: 0.6,
  sleeveLeft: { centerU: 0.32, v0: 0.1 },
  sleeveRight: { centerU: 0.96, v0: 0.1 },
  rib: { u0: 0.05, v0: 0.37, height: 0.05 },
} as const;
