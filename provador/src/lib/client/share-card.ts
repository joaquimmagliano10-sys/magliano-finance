"use client";

import { BRAND } from "../brand";
import { formatPrice } from "../format";
import { canvasToBlob, loadImage } from "./images";

/**
 * Imagem pronta para stories/WhatsApp (1080×1350): a foto da prova + faixa com
 * o nome da camisa, preço e a marca.
 */
export async function buildShareCard(opts: { image: string; nome: string; cor: string; preco: number; selo?: string }): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const band = 230;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#17191d";
  ctx.fillRect(0, 0, W, H);
  const img = await loadImage(opts.image);
  const areaH = H - band;
  const scale = Math.max(W / img.naturalWidth, areaH / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, Math.min(0, (areaH - dh) * 0.35), dw, dh);
  const grad = ctx.createLinearGradient(0, areaH - 160, 0, areaH);
  grad.addColorStop(0, "rgba(23,25,29,0)");
  grad.addColorStop(1, "rgba(23,25,29,0.9)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, areaH - 160, W, 160);
  ctx.fillStyle = "#17191d";
  ctx.fillRect(0, areaH, W, band);
  ctx.fillStyle = "#c7a96b";
  ctx.fillRect(64, areaH + 40, 56, 6);
  ctx.font = "700 54px 'Space Grotesk', Inter, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(opts.nome, 64, areaH + 112, W - 380);
  ctx.font = "500 32px Inter, sans-serif";
  ctx.fillStyle = "#b9bcc3";
  ctx.fillText(`Cor ${opts.cor} · provador virtual`, 64, areaH + 164, W - 380);
  ctx.textAlign = "right";
  ctx.font = "700 56px 'Space Grotesk', Inter, sans-serif";
  ctx.fillStyle = "#c7a96b";
  ctx.fillText(formatPrice(opts.preco), W - 64, areaH + 112);
  ctx.font = "700 30px 'Space Grotesk', Inter, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(BRAND.nome.split("").join(" "), W - 64, areaH + 164);
  if (opts.selo) {
    ctx.textAlign = "left";
    ctx.font = "600 26px Inter, sans-serif";
    const tw = ctx.measureText(opts.selo).width;
    ctx.fillStyle = "rgba(23,25,29,0.7)";
    ctx.beginPath();
    ctx.roundRect(40, 40, tw + 40, 54, 27);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(opts.selo, 60, 76);
  }
  return canvasToBlob(c, "image/jpeg", 0.92);
}
