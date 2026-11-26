"use client";

import type { Landmark, MaskData } from "../body/estimate";
import type { ShirtTextureSpec } from "./shirt-texture";
import { loadImage } from "./images";

/**
 * PRÉVIA SIMULADA (modo demonstração) — usada quando nenhuma API de try-on está
 * configurada ou quando a API falha.
 *
 * Não é IA generativa: usamos os pontos do corpo e a silhueta (MediaPipe) para
 * "repintar" a região do tronco e das mangas com a cor/estampa da camisa,
 * preservando as sombras e dobras da roupa original da foto. Funciona bem com
 * camisetas na foto; com casacos, golas altas ou braços cruzados o resultado é
 * apenas indicativo. A interface sempre identifica esta prévia como simulada.
 */
interface P {
  x: number;
  y: number;
}
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
const len = (a: P) => Math.hypot(a.x, a.y);
const norm = (a: P): P => mul(a, 1 / (len(a) || 1));

export async function demoTryOn(opts: {
  photo: HTMLImageElement | ImageBitmap;
  width: number;
  height: number;
  landmarks: Landmark[];
  mask: MaskData | null;
  spec: ShirtTextureSpec;
}): Promise<string> {
  const { width: W, height: H, landmarks: lm, mask, spec } = opts;
  const pt = (i: number): P => ({ x: lm[i].x * W, y: lm[i].y * H });
  const ls = pt(11);
  const rs = pt(12);
  const lh = pt(23);
  const rh = pt(24);
  const le = pt(13);
  const re = pt(14);
  const sMid = mul(add(ls, rs), 0.5);
  const hMid = mul(add(lh, rh), 0.5);
  const across = norm(sub(ls, rs)); // do ombro direito para o esquerdo da pessoa
  const down = norm(sub(hMid, sMid));
  const sw = len(sub(ls, rs));
  const hw = len(sub(lh, rh));
  const tl = len(sub(hMid, sMid));
  const pxPerM = sw / 0.36;

  // 1) Região da camiseta (tronco + mangas curtas)
  const region = document.createElement("canvas");
  region.width = W;
  region.height = H;
  const rc = region.getContext("2d")!;
  const at = (base: P, a: number, d: number) => add(base, add(mul(across, a), mul(down, d)));
  const neckL = at(sMid, sw * 0.2, -tl * 0.05);
  const neckR = at(sMid, -sw * 0.2, -tl * 0.05);
  const shL = at(ls, sw * 0.1, -tl * 0.06);
  const shR = at(rs, -sw * 0.1, -tl * 0.06);
  const sideL = at(ls, sw * 0.08, tl * 0.18);
  const sideR = at(rs, -sw * 0.08, tl * 0.18);
  const hemL = at(lh, hw * 0.75, tl * 0.1);
  const hemR = at(rh, -hw * 0.75, tl * 0.1);
  rc.fillStyle = "#fff";
  rc.beginPath();
  rc.moveTo(neckR.x, neckR.y);
  rc.lineTo(shR.x, shR.y);
  rc.lineTo(sideR.x, sideR.y);
  rc.lineTo(hemR.x, hemR.y);
  const hemMid = at(hMid, 0, tl * 0.13);
  rc.quadraticCurveTo(hemMid.x, hemMid.y, hemL.x, hemL.y);
  rc.lineTo(sideL.x, sideL.y);
  rc.lineTo(shL.x, shL.y);
  rc.lineTo(neckL.x, neckL.y);
  const dip = at(sMid, 0, tl * 0.07);
  rc.quadraticCurveTo(dip.x, dip.y, neckR.x, neckR.y);
  rc.fill();
  // mangas: do ombro até ~42% do braço
  rc.strokeStyle = "#fff";
  rc.lineCap = "butt";
  rc.lineWidth = sw * 0.34;
  for (const [s, e] of [
    [ls, le],
    [rs, re],
  ] as const) {
    const end = add(s, mul(sub(e, s), 0.42));
    const start = add(s, mul(norm(sub(s, e)), sw * 0.04));
    rc.beginPath();
    rc.moveTo(start.x, start.y);
    rc.lineTo(end.x, end.y);
    rc.stroke();
  }
  // recorta pela silhueta da pessoa
  if (mask) {
    const mc = document.createElement("canvas");
    mc.width = mask.width;
    mc.height = mask.height;
    const mctx = mc.getContext("2d")!;
    const id = mctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.data.length; i++) {
      const a = Math.max(0, Math.min(1, (mask.data[i] - 0.35) / 0.3));
      id.data[i * 4] = 255;
      id.data[i * 4 + 1] = 255;
      id.data[i * 4 + 2] = 255;
      id.data[i * 4 + 3] = a * 255;
    }
    mctx.putImageData(id, 0, 0);
    rc.globalCompositeOperation = "destination-in";
    rc.imageSmoothingQuality = "high";
    rc.drawImage(mc, 0, 0, W, H);
    rc.globalCompositeOperation = "source-over";
  }
  // borda suave
  const feather = document.createElement("canvas");
  feather.width = W;
  feather.height = H;
  const fc = feather.getContext("2d")!;
  fc.filter = `blur(${Math.max(1, W / 700)}px)`;
  fc.drawImage(region, 0, 0);

  // 2) Cor/estampa da camisa ("albedo")
  const albedo = document.createElement("canvas");
  albedo.width = W;
  albedo.height = H;
  const ac = albedo.getContext("2d")!;
  ac.fillStyle = spec.hex;
  ac.fillRect(0, 0, W, H);
  const angle = Math.atan2(across.y, across.x);
  if (spec.padrao) {
    const pat = await loadImage(spec.padrao).catch(() => null);
    if (pat) {
      const tile = Math.max(6, spec.padraoEscala * pxPerM);
      const t = document.createElement("canvas");
      t.width = Math.round(tile);
      t.height = Math.round(tile);
      t.getContext("2d")!.drawImage(pat, 0, 0, t.width, t.height);
      ac.save();
      ac.translate(sMid.x, sMid.y);
      ac.rotate(angle);
      ac.fillStyle = ac.createPattern(t, "repeat")!;
      ac.fillRect(-W * 2, -H * 2, W * 4, H * 4);
      ac.restore();
    }
  }
  if (spec.estampaFrente) {
    const img = await loadImage(spec.estampaFrente).catch(() => null);
    if (img) {
      const left = spec.estampaPosicao === "peito-esquerdo";
      const wM = left ? Math.min(0.1, spec.estampaLargura) : spec.estampaLargura;
      const w = wM * pxPerM;
      const h = (w * img.naturalHeight) / img.naturalWidth;
      // a foto é como num espelho de loja: o lado esquerdo da pessoa fica à direita da imagem
      const anchor = left ? at(sMid, 0.1 * pxPerM, tl * 0.2) : at(sMid, 0, tl * 0.15);
      ac.save();
      ac.translate(anchor.x, anchor.y);
      ac.rotate(angle);
      ac.drawImage(img, -w / 2, 0, w, h);
      ac.restore();
    }
  }

  // 3) Composição com o sombreamento da roupa original
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const oc = out.getContext("2d")!;
  oc.drawImage(opts.photo, 0, 0, W, H);
  const photo = oc.getImageData(0, 0, W, H);
  const reg = fc.getImageData(0, 0, W, H).data;
  const alb = ac.getImageData(0, 0, W, H).data;
  const p = photo.data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < p.length; i += 4) {
    if (reg[i + 3] > 128) {
      sum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      n++;
    }
  }
  const mean = n ? sum / n : 128;
  for (let i = 0; i < p.length; i += 4) {
    const a = reg[i + 3] / 255;
    if (a <= 0.004) continue;
    const L = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    let s = L / (mean || 1);
    s = 1 + (Math.max(0.4, Math.min(1.5, s)) - 1) * 0.7;
    for (let c = 0; c < 3; c++) {
      const v = Math.min(255, alb[i + c] * s);
      p[i + c] = p[i + c] * (1 - a) + v * a;
    }
  }
  oc.putImageData(photo, 0, 0);
  return out.toDataURL("image/jpeg", 0.9);
}
