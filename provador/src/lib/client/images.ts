"use client";

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Carrega (e guarda em cache) uma imagem para desenhar em canvas. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => {
        cache.delete(src);
        reject(new Error(`Falha ao carregar ${src}`));
      };
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

/**
 * Reduz a foto no próprio aparelho antes de enviar: menos dados trafegando,
 * resposta mais rápida e — ao redesenhar no canvas — os metadados EXIF (como
 * localização GPS) são descartados.
 */
export async function preparePhoto(file: Blob, maxSide = 1280): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.9));
  return { blob, width: w, height: h };
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", q = 0.92): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), type, q));
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const r = await fetch(dataUrl);
  return r.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
