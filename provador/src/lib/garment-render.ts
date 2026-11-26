import sharp from "sharp";
import type { PrintPosition } from "./types";

/**
 * Gera uma imagem "flat lay" (camiseta estendida, vista de frente) a partir da
 * cor + estampa/padrão. Usada:
 *  - no seed (fotos de catálogo das camisas de exemplo);
 *  - no admin, quando uma cor não tem foto própria — a IA de try-on precisa de
 *    uma imagem da peça em cada cor.
 * Para melhor resultado na IA, prefira fotos reais da peça; esta imagem é um
 * mockup vetorial com sombreamento suave.
 */
export interface GarmentRenderInput {
  hex: string;
  estampaFrente?: Buffer | null;
  padrao?: Buffer | null;
  padraoEscala?: number; // m
  estampaLargura?: number; // m
  estampaPosicao?: PrintPosition;
  fundo?: string;
  width?: number;
}

const W = 1000;
const H = 1200;
/** escala do desenho: a peça M estendida tem ~53 cm de largura → ~9,4 px/cm */
const PX_PER_M = 940;

export const SHIRT_PATH =
  "M395 150 L230 196 C190 230 120 330 92 404 L200 468 L255 400 C252 600 246 900 240 1090 Q500 1112 760 1090 C754 900 748 600 745 400 L800 468 L908 404 C880 330 810 230 770 196 L605 150 C590 225 410 225 395 150 Z";
const NECK_FRONT = "M395 150 C410 225 590 225 605 150";
const NECK_BACK = "M395 150 C430 178 570 178 605 150 C590 225 410 225 395 150 Z";

const luminance = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

const dataUri = (b: Buffer, mime = "image/png") => `data:${mime};base64,${b.toString("base64")}`;

export async function renderGarment(input: GarmentRenderInput): Promise<Buffer> {
  const hex = /^#[0-9a-f]{6}$/i.test(input.hex) ? input.hex : "#cccccc";
  const dark = luminance(hex) < 0.35;
  const shadowOp = dark ? 0.35 : 0.16;
  const lightOp = dark ? 0.1 : 0.22;
  const fundo = input.fundo ?? "#f4f2ee";

  let printSvg = "";
  if (input.estampaFrente) {
    const meta = await sharp(input.estampaFrente).metadata();
    const ratio = (meta.height ?? 1) / (meta.width ?? 1);
    const left = input.estampaPosicao === "peito-esquerdo";
    const wPx = Math.min(left ? 120 : 420, (input.estampaLargura ?? 0.26) * PX_PER_M);
    const hPx = wPx * ratio;
    const x = left ? 500 + 118 - wPx / 2 : 500 - wPx / 2;
    const y = left ? 290 : 275;
    printSvg = `<image x="${x}" y="${y}" width="${wPx}" height="${hPx}" preserveAspectRatio="xMidYMid meet" href="${dataUri(input.estampaFrente)}" xlink:href="${dataUri(input.estampaFrente)}"/>`;
  }
  let patternDef = "";
  let patternFill = "";
  if (input.padrao) {
    const tile = Math.max(30, (input.padraoEscala ?? 0.18) * PX_PER_M);
    patternDef = `<pattern id="pad" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><image width="${tile}" height="${tile}" href="${dataUri(input.padrao)}" xlink:href="${dataUri(input.padrao)}"/></pattern>`;
    patternFill = `<path d="${SHIRT_PATH}" fill="url(#pad)"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="shirt"><path d="${SHIRT_PATH}"/></clipPath>
    <filter id="blur8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="blur20" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="20"/></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
    <linearGradient id="sides" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="${shadowOp}"/>
      <stop offset="0.22" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.78" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="${shadowOp}"/>
    </linearGradient>
    <radialGradient id="light" cx="0.45" cy="0.3" r="0.6">
      <stop offset="0" stop-color="#fff" stop-opacity="${lightOp}"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    ${patternDef}
  </defs>
  <rect width="100%" height="100%" fill="${fundo}"/>
  <path d="${SHIRT_PATH}" transform="translate(10 22)" fill="#000" opacity="0.18" filter="url(#shadow)"/>
  <path d="${SHIRT_PATH}" fill="${hex}"/>
  ${patternFill}
  <path d="${NECK_BACK}" fill="#000" opacity="${dark ? 0.35 : 0.14}"/>
  <g clip-path="url(#shirt)">
    ${printSvg}
    <rect width="100%" height="100%" fill="url(#sides)"/>
    <rect width="100%" height="100%" fill="url(#light)"/>
    <g filter="url(#blur20)" opacity="${dark ? 0.5 : 0.28}">
      <path d="M300 430 C330 650 300 860 330 1090" stroke="#000" stroke-width="26" fill="none"/>
      <path d="M690 450 C660 640 700 880 660 1090" stroke="#000" stroke-width="22" fill="none"/>
      <path d="M520 760 C560 900 520 1000 560 1100" stroke="#000" stroke-width="18" fill="none"/>
    </g>
    <g filter="url(#blur8)" opacity="${dark ? 0.12 : 0.35}">
      <path d="M330 460 C360 660 330 860 360 1080" stroke="#fff" stroke-width="12" fill="none"/>
      <path d="M640 470 C620 650 655 860 625 1080" stroke="#fff" stroke-width="10" fill="none"/>
    </g>
    <path d="M770 196 C755 260 748 330 745 400 M230 196 C245 260 252 330 255 400" stroke="#000" stroke-opacity="0.22" stroke-width="3" fill="none"/>
    <path d="M244 1062 Q500 1084 756 1062" stroke="#000" stroke-opacity="0.25" stroke-width="2.5" stroke-dasharray="9 7" fill="none"/>
    <path d="M206 448 L104 388 M794 448 L896 388" stroke="#000" stroke-opacity="0.22" stroke-width="2.5" stroke-dasharray="9 7" fill="none"/>
  </g>
  <path d="${NECK_FRONT}" stroke="#000" stroke-opacity="${dark ? 0.45 : 0.2}" stroke-width="22" fill="none"/>
  <path d="${NECK_FRONT}" stroke="${hex}" stroke-width="16" fill="none"/>
  <path d="${NECK_FRONT}" stroke="#000" stroke-opacity="0.18" stroke-width="2" stroke-dasharray="7 6" fill="none" transform="translate(0 9)"/>
</svg>`;
  const out = sharp(Buffer.from(svg));
  return input.width && input.width !== W ? out.resize({ width: input.width }).png().toBuffer() : out.png().toBuffer();
}
