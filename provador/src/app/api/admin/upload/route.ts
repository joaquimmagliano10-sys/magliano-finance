import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { errorJson, json } from "@/lib/http";
import { sniffImage } from "@/lib/image";
import { saveCatalogFile } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * POST /api/admin/upload — envia UMA imagem do catálogo (foto, estampa ou padrão).
 * Estampas/padrões mantêm a transparência (PNG); fotos viram JPEG otimizado.
 * Um arquivo por requisição para respeitar o limite de 4,5 MB das funções da Vercel.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("arquivo");
  const tipo = String(form?.get("tipo") ?? "foto");
  if (!(file instanceof File)) return errorJson("Envie um arquivo.");
  if (file.size > 8 * 1024 * 1024) return errorJson("Arquivo muito grande (máx. 8 MB).", 413);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return errorJson("Use JPG, PNG ou WebP.", 415);
  try {
    const keepAlpha = tipo === "estampa" || tipo === "padrao";
    const img = sharp(buf, { limitInputPixels: 50_000_000 }).rotate();
    const out = keepAlpha
      ? await img.resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
      : await img.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    const name = file.name.replace(/\.[a-z0-9]+$/i, "") + (keepAlpha ? ".png" : ".jpg");
    const url = await saveCatalogFile(name, out, keepAlpha ? "image/png" : "image/jpeg");
    return json({ url });
  } catch (err) {
    console.error("[upload]", err);
    return errorJson("Não foi possível processar a imagem.", 500);
  }
}
