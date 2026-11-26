import { describe, expect, it } from "vitest";
import { estimateMeasurements, type Landmark, type MaskData } from "@/lib/body/estimate";

/**
 * Pessoa sintética de 1,80 m numa foto 600×1200 (1 px = 2 mm, corpo inteiro),
 * com silhueta desenhada a partir de larguras conhecidas.
 */
const W = 600;
const H = 1200;
const PX_PER_M = 500;
const top = 100; // topo da cabeça (px)
const y = (m: number) => top + (1.8 - m) * PX_PER_M; // altura do chão (m) → linha da imagem

function person(opts: { chestW: number; waistW: number; hipW: number; shoulderW: number; armsGap?: boolean }) {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  const set = (i: number, xm: number, hm: number) => (lm[i] = { x: (W / 2 + xm * PX_PER_M) / W, y: y(hm) / H, visibility: 0.99 });
  set(0, 0, 1.66); // nariz
  set(11, 0.185, 1.46); // ombro esquerdo (aparece à direita da imagem)
  set(12, -0.185, 1.46);
  set(23, 0.09, 0.94);
  set(24, -0.09, 0.94);
  set(27, 0.1, 0.08);
  set(28, -0.1, 0.08);
  set(29, 0.1, 0.02);
  set(30, -0.1, 0.02);
  const data = new Float32Array(W * H);
  const fill = (y0: number, y1: number, half: number) => {
    for (let yy = Math.round(y0); yy < Math.round(y1); yy++)
      for (let xx = Math.round(W / 2 - half); xx < Math.round(W / 2 + half); xx++) data[yy * W + xx] = 1;
  };
  // cabeça e pescoço
  fill(y(1.8), y(1.55), 0.08 * PX_PER_M);
  // tronco: interpolação simples entre as larguras
  for (let hm = 1.5; hm > 0.85; hm -= 0.002) {
    const t = (1.5 - hm) / 0.65;
    const w =
      hm > 1.42
        ? opts.shoulderW
        : hm > 1.3
          ? opts.chestW
          : t < 0.6
            ? opts.chestW + ((opts.waistW - opts.chestW) * (t - 0.18)) / 0.42
            : opts.waistW + ((opts.hipW - opts.waistW) * (t - 0.6)) / 0.4;
    fill(y(hm), y(hm - 0.002), (Math.max(w, 0.2) / 2) * PX_PER_M);
  }
  // pernas
  fill(y(0.86), y(0.0), 0.15 * PX_PER_M);
  // braços afastados do corpo (com vão) ou colados
  const armX = opts.armsGap ? 0.32 : 0.2;
  for (const s of [1, -1]) {
    for (let yy = Math.round(y(1.44)); yy < Math.round(y(0.85)); yy++)
      for (let xx = Math.round(W / 2 + s * armX * PX_PER_M - 20); xx < Math.round(W / 2 + s * armX * PX_PER_M + 20); xx++) data[yy * W + xx] = 1;
  }
  const mask: MaskData = { data, width: W, height: H };
  return { lm, mask };
}

describe("estimativa de medidas", () => {
  it("recupera proporções plausíveis de uma silhueta conhecida (corpo inteiro + altura)", () => {
    const { lm, mask } = person({ shoulderW: 0.47, chestW: 0.34, waistW: 0.3, hipW: 0.36, armsGap: true });
    const r = estimateMeasurements({ landmarks: lm, mask, imageWidth: W, imageHeight: H, sexo: "masculino", altura: 1.8 });
    expect(r.ok).toBe(true);
    expect(r.fullBody).toBe(true);
    // peito ≈ 0,34 × 0,96 × 2,95 ≈ 0,96 m, encolhido em direção ao corpo médio
    expect(r.measurements.peito).toBeGreaterThan(0.9);
    expect(r.measurements.peito).toBeLessThan(1.05);
    expect(r.measurements.cintura).toBeLessThan(r.measurements.peito);
    expect(r.measurements.altura).toBe(1.8);
    expect(r.scanLines.length).toBe(4);
  });

  it("silhueta mais larga → medidas maiores", () => {
    const slim = person({ shoulderW: 0.44, chestW: 0.31, waistW: 0.27, hipW: 0.33, armsGap: true });
    const big = person({ shoulderW: 0.52, chestW: 0.4, waistW: 0.38, hipW: 0.41, armsGap: true });
    const a = estimateMeasurements({ landmarks: slim.lm, mask: slim.mask, imageWidth: W, imageHeight: H, sexo: "masculino", altura: 1.8 });
    const b = estimateMeasurements({ landmarks: big.lm, mask: big.mask, imageWidth: W, imageHeight: H, sexo: "masculino", altura: 1.8 });
    expect(b.measurements.peito).toBeGreaterThan(a.measurements.peito + 0.05);
    expect(b.measurements.cintura).toBeGreaterThan(a.measurements.cintura + 0.05);
  });

  it("braços colados ao corpo: não mede peito/cintura pela silhueta e avisa", () => {
    const { lm, mask } = person({ shoulderW: 0.47, chestW: 0.34, waistW: 0.3, hipW: 0.36, armsGap: false });
    const r = estimateMeasurements({ landmarks: lm, mask, imageWidth: W, imageHeight: H, sexo: "masculino", altura: 1.8 });
    expect(r.ok).toBe(true);
    expect(r.measurements.peito).toBeLessThan(1.15); // não "engole" os braços
  });

  it("falha de forma controlada sem ombros/quadril visíveis", () => {
    const { lm, mask } = person({ shoulderW: 0.47, chestW: 0.34, waistW: 0.3, hipW: 0.36 });
    lm[23].visibility = 0.1;
    const r = estimateMeasurements({ landmarks: lm, mask, imageWidth: W, imageHeight: H, sexo: "feminino" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/ombros e o quadril/);
    expect(r.measurements.sexo).toBe("feminino");
  });
});
