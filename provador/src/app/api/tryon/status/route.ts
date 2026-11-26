import { appSecret } from "@/lib/config";
import { enforceLimit, errorJson, json } from "@/lib/http";
import { verifyToken } from "@/lib/tokens";
import { fetchResultImage, providerById } from "@/lib/tryon";
import type { JobRef } from "@/lib/tryon/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/tryon/status?job=<token> — consulta o andamento da prova.
 * Quando pronta, devolve a imagem como data URI (o navegador não precisa
 * acessar o CDN do provedor e o link original não é exposto).
 */
export async function GET(req: Request) {
  const limited = await enforceLimit(req, "tryon-status", { max: 240, windowSec: 600 });
  if (limited) return limited;
  const token = new URL(req.url).searchParams.get("job") ?? "";
  const job = verifyToken<{ p: string; r: JobRef; c: string }>(token, appSecret());
  if (!job) return errorJson("Prova expirada ou inválida. Tente de novo.", 410);
  const provider = providerById(job.p);
  if (!provider) return errorJson("Provedor indisponível.", 503);
  try {
    const st = await provider.status(job.r);
    if (st.state === "processing") return json({ estado: "processando" });
    if (st.state === "failed") return json({ estado: "erro", mensagem: st.error });
    const img = await fetchResultImage(st.image);
    return json({ estado: "pronto", imagem: `data:${img.mime};base64,${img.data.toString("base64")}` });
  } catch (err) {
    console.error("[tryon/status]", (err as Error).message);
    // erro transitório: o cliente tenta de novo no próximo ciclo
    return json({ estado: "processando", aviso: "instavel" });
  }
}
