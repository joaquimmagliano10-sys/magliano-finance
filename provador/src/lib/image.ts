import sharp from "sharp";

/**
 * Validação e normalização de imagens enviadas.
 * - Confere o tipo REAL pelo cabeçalho do arquivo (não confia na extensão/MIME).
 * - Corrige a rotação EXIF e remove TODOS os metadados (inclusive GPS).
 * - Reduz para no máximo `maxSide` px (menos custo e latência na API).
 */
export type ImageKind = "jpeg" | "png" | "webp";

export function sniffImage(buf: Uint8Array): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  const riff = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

export class ImageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function normalizePhoto(
  input: Buffer,
  opts: { maxBytes: number; maxSide?: number; minSide?: number; quality?: number },
): Promise<{ data: Buffer; width: number; height: number }> {
  if (input.length > opts.maxBytes) throw new ImageError(`Imagem muito grande (máximo ${Math.round(opts.maxBytes / 1048576)} MB).`, 413);
  if (!sniffImage(input)) throw new ImageError("Formato não suportado. Envie JPG, PNG ou WebP.", 415);
  const img = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const meta = await img.metadata();
  const minSide = opts.minSide ?? 256;
  const w = meta.autoOrient?.width ?? meta.width ?? 0;
  const h = meta.autoOrient?.height ?? meta.height ?? 0;
  if (Math.min(w, h) < minSide) throw new ImageError(`Imagem muito pequena (mínimo ${minSide}px).`);
  const maxSide = opts.maxSide ?? 1280;
  const { data, info } = await img
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: opts.quality ?? 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export const toDataUri = (data: Buffer, mime = "image/jpeg") => `data:${mime};base64,${data.toString("base64")}`;
