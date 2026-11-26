import { config } from "@/lib/config";
import { json } from "@/lib/http";
import { purgeExpiredResults } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Limpeza dos resultados temporários. Chamado pelo Vercel Cron (vercel.json),
 * que envia "Authorization: Bearer <CRON_SECRET>". Além do cron, a limpeza
 * também roda a cada novo resultado salvo, e a leitura recusa links vencidos.
 */
export async function GET(req: Request) {
  if (config.cronSecret && req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return json({ erro: "Não autorizado" }, 401);
  }
  if (!config.cronSecret && config.isProd) return json({ erro: "Defina CRON_SECRET" }, 401);
  const removidos = await purgeExpiredResults();
  return json({ ok: true, removidos });
}
