/**
 * Estimativa de medidas corporais a partir de UMA foto de frente.
 *
 * Entradas: os 33 pontos do MediaPipe Pose (normalizados 0–1) e a máscara de
 * segmentação da pessoa. Saída: altura, ombros, peito, cintura e quadril.
 *
 * O que é medido de verdade: larguras da silhueta (de frente) em alturas do
 * tronco definidas pelos pontos de ombro e quadril, e — com o corpo inteiro na
 * foto — a proporção entre essas larguras e a estatura.
 *
 * O que é suposição (limitações honestas):
 *  - A profundidade do corpo (barriga, costas) NÃO aparece numa foto de frente.
 *    As circunferências saem de larguras × fatores antropométricos médios.
 *  - Sem a altura informada pelo cliente, a escala absoluta usa uma altura média.
 *  - Roupas largas aumentam a silhueta; braços colados ao corpo impedem medir
 *    peito/cintura (nesses casos caímos para proporções médias).
 *  - O resultado é "puxado" para o corpo médio conforme a confiança, para evitar
 *    avatares absurdos com fotos ruins.
 * Ou seja: o avatar 360° é uma APROXIMAÇÃO das proporções, não uma réplica do corpo.
 */
import { clampMeasurements } from "./morphs";
import { BASE_BODY, type BodyMeasurements, type Sexo } from "./types";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface MaskData {
  data: Float32Array;
  width: number;
  height: number;
}

export interface EstimateInput {
  landmarks: Landmark[];
  mask: MaskData | null;
  imageWidth: number;
  imageHeight: number;
  sexo: Sexo;
  /** altura informada pelo cliente, em metros (opcional, melhora muito a escala) */
  altura?: number;
}

export interface ScanLine {
  label: string;
  y: number;
  x0: number;
  x1: number;
  measured: boolean;
}

export interface EstimateResult {
  ok: boolean;
  reason?: string;
  warnings: string[];
  measurements: BodyMeasurements;
  confidence: number;
  fullBody: boolean;
  scanLines: ScanLine[];
}

const LM = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lHip: 23,
  rHip: 24,
  lAnkle: 27,
  rAnkle: 28,
  lHeel: 29,
  rHeel: 30,
} as const;

/** Fatores circunferência ÷ largura frontal (médias antropométricas aproximadas). */
const CIRC_FACTOR: Record<Sexo, { peito: number; cintura: number; quadril: number }> = {
  masculino: { peito: 2.95, cintura: 2.95, quadril: 2.75 },
  feminino: { peito: 3.05, cintura: 2.8, quadril: 2.75 },
};

/** Proporções médias em relação à estatura, usadas para escala e como reserva. */
const RATIO: Record<Sexo, { shoulderJoints: number; torso: number; bideltoid: number; hipJoints: number }> = {
  masculino: { shoulderJoints: 0.212, torso: 0.29, bideltoid: 0.263, hipJoints: 0.1 },
  feminino: { shoulderJoints: 0.205, torso: 0.285, bideltoid: 0.243, hipJoints: 0.104 },
};

const CLOTHING = 0.96; // desconto médio pela espessura/folga da roupa

type P = { x: number; y: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

function maskAt(mask: MaskData, x: number, y: number, W: number, H: number): number {
  const mx = Math.round((x / W) * (mask.width - 1));
  const my = Math.round((y / H) * (mask.height - 1));
  if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) return 0;
  return mask.data[my * mask.width + mx];
}

/** Trecho contínuo da silhueta na linha y que contém (ou fica perto de) cx. */
function runAt(mask: MaskData, y: number, cx: number, W: number, H: number): [number, number] | null {
  const step = W / mask.width;
  let start = cx;
  if (maskAt(mask, cx, y, W, H) < 0.5) {
    let found = false;
    for (let k = 1; k < 12 && !found; k++) {
      for (const s of [1, -1]) {
        const x = cx + s * k * step;
        if (maskAt(mask, x, y, W, H) >= 0.5) {
          start = x;
          found = true;
          break;
        }
      }
    }
    if (!found) return null;
  }
  const walk = (dir: 1 | -1) => {
    let x = start;
    let gap = 0;
    let last = start;
    while (x > 0 && x < W) {
      x += dir * step;
      if (maskAt(mask, x, y, W, H) >= 0.5) {
        last = x;
        gap = 0;
      } else if (++gap > 2) break;
    }
    return last;
  };
  return [walk(-1), walk(1)];
}

function measureRow(mask: MaskData, y: number, cx: number, spread: number, W: number, H: number) {
  const widths: number[] = [];
  const x0s: number[] = [];
  const x1s: number[] = [];
  for (const k of [-2, -1, 0, 1, 2]) {
    const r = runAt(mask, y + k * spread, cx, W, H);
    if (r) {
      widths.push(r[1] - r[0]);
      x0s.push(r[0]);
      x1s.push(r[1]);
    }
  }
  if (widths.length < 3) return null;
  return { width: median(widths), x0: median(x0s), x1: median(x1s) };
}

export function estimateMeasurements(input: EstimateInput): EstimateResult {
  const { sexo, imageWidth: W, imageHeight: H, mask } = input;
  const base = BASE_BODY[sexo];
  const altura = input.altura ?? base.altura;
  const warnings: string[] = [];
  const lm = input.landmarks;
  const fallback = (reason: string): EstimateResult => ({
    ok: false,
    reason,
    warnings,
    measurements: clampMeasurements({ ...base, altura, ombros: base.ombros * (altura / base.altura) }),
    confidence: 0,
    fullBody: false,
    scanLines: [],
  });

  if (!lm || lm.length < 33) return fallback("Nenhuma pessoa encontrada na foto.");
  const vis = (i: number) => lm[i].visibility ?? 1;
  const px = (i: number): P => ({ x: lm[i].x * W, y: lm[i].y * H });
  if ([LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip].some((i) => vis(i) < 0.5)) {
    return fallback("Não conseguimos ver os ombros e o quadril. Use uma foto de frente, da cintura para cima ou de corpo inteiro.");
  }

  const ls = px(LM.lShoulder);
  const rs = px(LM.rShoulder);
  const lh = px(LM.lHip);
  const rh = px(LM.rHip);
  const sMid = mid(ls, rs);
  const hMid = mid(lh, rh);
  const shoulderPx = dist(ls, rs);
  const hipPx = dist(lh, rh);
  const torsoPx = dist(sMid, hMid);
  const torsoV = hMid.y - sMid.y;
  if (torsoV <= 0 || shoulderPx < 10) return fallback("A pose detectada não parece estar em pé e de frente.");

  let confidence = 0.9;
  const tilt = Math.abs(Math.atan2(ls.y - rs.y, ls.x - rs.x));
  const tiltDeg = Math.min(tilt, Math.PI - tilt) * (180 / Math.PI);
  if (tiltDeg > 12) {
    confidence -= 0.2;
    warnings.push("Os ombros estão inclinados — fique reto para uma estimativa melhor.");
  }
  const frontal = shoulderPx / torsoPx;
  if (frontal < 0.55) {
    confidence -= 0.25;
    warnings.push("Parece que você está de lado. Fique de frente para a câmera.");
  }

  // ── Escala (metros por pixel)
  const r = RATIO[sexo];
  const mppRatio = median([(r.shoulderJoints * altura) / shoulderPx, (r.torso * altura) / torsoPx]);
  let mpp = mppRatio;
  const fullBody = [LM.nose, LM.lAnkle, LM.rAnkle].every((i) => vis(i) > 0.5) && lm[LM.lAnkle].y < 1 && lm[LM.rAnkle].y < 1;
  if (fullBody && mask) {
    // topo da cabeça: sobe pela coluna do nariz até sair da silhueta
    const nose = px(LM.nose);
    let top = nose.y;
    for (let y = nose.y; y > 0; y -= H / mask.height) {
      if (maskAt(mask, nose.x, y, W, H) >= 0.5) top = y;
      else if (nose.y - y > 4 * (H / mask.height)) break;
    }
    const heelY = Math.max(
      vis(LM.lHeel) > 0.3 ? px(LM.lHeel).y : px(LM.lAnkle).y + 0.02 * H,
      vis(LM.rHeel) > 0.3 ? px(LM.rHeel).y : px(LM.rAnkle).y + 0.02 * H,
    );
    const stature = heelY - top;
    if (stature > torsoPx * 2.2) {
      mpp = altura / stature;
      if (!input.altura) {
        warnings.push("Informe sua altura para medidas em centímetros mais precisas.");
        confidence -= 0.1;
      }
    }
  } else {
    if (!input.altura) confidence -= 0.1;
    confidence -= 0.1;
  }

  // ── Larguras da silhueta
  const scanLines: ScanLine[] = [];
  const cxAt = (t: number) => sMid.x + (hMid.x - sMid.x) * t;
  const yAt = (t: number) => sMid.y + torsoV * t;
  const spread = Math.max(1, torsoV * 0.02);
  const take = (label: string, t: number, maxPx: number) => {
    if (!mask) return null;
    const row = measureRow(mask, yAt(t), cxAt(t), spread, W, H);
    if (!row) return null;
    const ok = row.width <= maxPx && row.width > shoulderPx * 0.45;
    scanLines.push({ label, y: yAt(t), x0: row.x0, x1: row.x1, measured: ok });
    return ok ? row.width : null;
  };

  const bideltoidPx = take("Ombros", 0.07, shoulderPx * 1.7);
  const chestPx = take("Peito", 0.33, shoulderPx * 1.22);
  const waistPx = take("Cintura", 0.72, shoulderPx * 1.3);
  const hipWidthPx = take("Quadril", 1.0, shoulderPx * 1.38);

  const measuredCount = [bideltoidPx, chestPx, waistPx, hipWidthPx].filter((v) => v !== null).length;
  if (!mask) {
    confidence -= 0.3;
    warnings.push("Sem a silhueta, usamos apenas proporções médias.");
  } else if (measuredCount < 3) {
    confidence -= 0.15;
    warnings.push("Afaste um pouco os braços do corpo para medirmos peito e cintura.");
  }

  const m = (pxv: number) => pxv * mpp;
  const scale = altura / base.altura;
  const shouldersM = bideltoidPx !== null ? m(bideltoidPx) * 0.98 : r.bideltoid * altura;
  const f = CIRC_FACTOR[sexo];
  const chestM = chestPx !== null ? m(chestPx) * CLOTHING * f.peito : (shouldersM / base.ombros) * base.peito;
  const hipM = hipWidthPx !== null ? m(hipWidthPx) * CLOTHING * f.quadril : (m(hipPx) / (r.hipJoints * base.altura)) * base.quadril;
  const waistM =
    waistPx !== null
      ? m(waistPx) * CLOTHING * f.cintura
      : base.cintura * scale * ((chestM / (base.peito * scale)) * 0.6 + (hipM / (base.quadril * scale)) * 0.4);

  // Encolhe na direção do corpo médio conforme a confiança de cada medida
  const c = Math.max(0.15, Math.min(0.95, confidence));
  const shrink = (est: number, prior: number, measured: boolean) => prior + (est - prior) * (measured ? c : c * 0.5);
  const measurements = clampMeasurements({
    sexo,
    altura,
    ombros: shrink(shouldersM, base.ombros * scale, bideltoidPx !== null),
    peito: shrink(chestM, base.peito * scale, chestPx !== null),
    cintura: shrink(waistM, base.cintura * scale, waistPx !== null),
    quadril: shrink(hipM, base.quadril * scale, hipWidthPx !== null),
  });

  return {
    ok: true,
    warnings,
    measurements,
    confidence: Math.round(Math.max(0.1, Math.min(0.95, confidence * (0.6 + 0.1 * measuredCount))) * 100) / 100,
    fullBody,
    scanLines,
  };
}
