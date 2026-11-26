import { config } from "@/lib/config";
import { enforceLimit, errorJson, isKiosk, json } from "@/lib/http";
import { ImageError, normalizePhoto } from "@/lib/image";
import { saveTempResult } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * POST /api/resultados — guarda TEMPORARIAMENTE a imagem da prova para o
 * cliente baixar no próprio celular pelo QR code (modo loja). Expira em
 * RESULT_TTL_MINUTES (padrão 30 min; nunca mais de 24 h).
 */
export async function POST(req: Request) {
  const kiosk = isKiosk(req);
  const limited = await enforceLimit(req, kiosk ? "resultados-loja" : "resultados", kiosk ? { max: 200, windowSec: 3600 } : { max: 10, windowSec: 600 });
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  const file = form?.get("imagem");
  if (form?.get("consentimento") !== "sim") return errorJson("Consentimento necessário.", 403);
  if (!(file instanceof Blob)) return errorJson("Envie a imagem.");
  try {
    const img = await normalizePhoto(Buffer.from(await file.arrayBuffer()), { maxBytes: 6 * 1024 * 1024, maxSide: 1600, quality: 90 });
    const meta = await saveTempResult(img.data, String(form?.get("camisaId") ?? ""));
    return json({ token: meta.token, expiraEm: meta.expiresAt, url: `/r/${meta.token}`, ttlMinutos: config.resultTtlMinutes });
  } catch (err) {
    if (err instanceof ImageError) return errorJson(err.message, err.status);
    console.error("[resultados]", err);
    return errorJson("Não foi possível gerar o link.", 500);
  }
}
