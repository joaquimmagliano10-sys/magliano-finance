"use client";

import { getShirtLayout } from "../body/parametric";
import { type Sexo, UV_ATLAS_METERS, UV_LAYOUT } from "../body/types";
import { shade } from "../format";
import type { PrintPosition } from "../types";
import { loadImage } from "./images";

/**
 * Monta a textura da camiseta 3D a partir dos dados do produto.
 * O atlas (ver public/models/camiseta-uv-guia.png) representa 1,6 m × 1,6 m de
 * tecido, então estampas e padrões ficam na escala real da peça.
 */
export interface ShirtTextureSpec {
  hex: string;
  estampaFrente?: string | null;
  estampaCostas?: string | null;
  padrao?: string | null;
  padraoEscala: number;
  estampaLargura: number;
  estampaPosicao: PrintPosition;
}

const layoutCache = new Map<Sexo, ReturnType<typeof getShirtLayout>>();
const layout = (s: Sexo) => {
  let l = layoutCache.get(s);
  if (!l) {
    l = getShirtLayout(s);
    layoutCache.set(s, l);
  }
  return l;
};

export async function composeShirtTexture(spec: ShirtTextureSpec, sexo: Sexo, size = 2048, target?: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const canvas = target ?? document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const px = (u: number) => (u / UV_ATLAS_METERS) * size;
  const py = (v: number) => (1 - v / UV_ATLAS_METERS) * size;
  const len = (m: number) => (m / UV_ATLAS_METERS) * size;

  ctx.fillStyle = spec.hex;
  ctx.fillRect(0, 0, size, size);

  const [front, back, pattern] = await Promise.all([
    spec.estampaFrente ? loadImage(spec.estampaFrente).catch(() => null) : null,
    spec.estampaCostas ? loadImage(spec.estampaCostas).catch(() => null) : null,
    spec.padrao ? loadImage(spec.padrao).catch(() => null) : null,
  ]);

  if (pattern) {
    const tile = Math.max(8, Math.round(len(spec.padraoEscala)));
    const t = document.createElement("canvas");
    t.width = tile;
    t.height = tile;
    t.getContext("2d")!.drawImage(pattern, 0, 0, tile, tile);
    const pat = ctx.createPattern(t, "repeat");
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, size, size);
    }
  }

  // Gola canelada: um tom levemente diferente com listras verticais finas
  const rib = UV_LAYOUT.rib;
  const ry = py(rib.v0 + rib.height);
  const rh = len(rib.height);
  ctx.fillStyle = shade(spec.hex, -0.06);
  ctx.fillRect(0, ry - 2, size * 0.5, rh + 4);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = shade(spec.hex, -0.35);
  for (let x = 0; x < size * 0.5; x += 4) ctx.fillRect(x, ry, 1.5, rh);
  ctx.globalAlpha = 1;

  const lay = layout(sexo);
  const draw = (img: HTMLImageElement, cu: number, topV: number, widthM: number) => {
    const w = len(widthM);
    const h = (w * img.naturalHeight) / img.naturalWidth;
    ctx.drawImage(img, px(cu) - w / 2, py(topV), w, h);
  };
  if (front) {
    if (spec.estampaPosicao === "peito-esquerdo") {
      draw(front, lay.frontNeck.u + 0.1, lay.frontNeck.v - 0.09, Math.min(0.11, spec.estampaLargura));
    } else {
      draw(front, lay.frontNeck.u, lay.frontNeck.v - 0.075, spec.estampaLargura);
    }
  }
  if (back) draw(back, lay.backNeck.u, lay.backNeck.v - 0.1, Math.min(0.34, spec.estampaLargura * 1.12));
  return canvas;
}

/** Normal map de malha (ponto de tricô) — dá textura de tecido de perto. */
export function knitNormalCanvas(size = 128): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const hgt = (x: number, y: number) => {
    const col = 8;
    const cx = ((x % col) + col) % col;
    const row = Math.floor(y / 6);
    const off = row % 2 === 0 ? 0 : 0.5;
    const v = Math.abs(Math.sin((Math.PI * cx) / col));
    const s = Math.sin(((y / 6 + off) * Math.PI * 2) / 1) * 0.5 + 0.5;
    return v * 0.7 + s * 0.3;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y);
      const dy = hgt(x, y + 1) - hgt(x, y - 1);
      const nx = -dx * 1.4;
      const ny = -dy * 1.4;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
