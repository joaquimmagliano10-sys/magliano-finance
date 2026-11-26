import { repo } from "@/lib/db";
import { enforceLimit, errorJson, json } from "@/lib/http";

export const runtime = "nodejs";

/** POST /api/eventos { camisaId, origem } — registra uma prova no 360° (métrica). */
export async function POST(req: Request) {
  const limited = await enforceLimit(req, "eventos", { max: 60, windowSec: 600 });
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { camisaId?: string; origem?: string } | null;
  if (!body?.camisaId) return errorJson("camisaId obrigatório");
  const shirt = await repo().getShirt(body.camisaId);
  if (!shirt) return errorJson("Camisa não encontrada", 404);
  await repo().recordEvent(shirt.id, "360", body.origem === "loja" ? "loja" : "web");
  return json({ ok: true });
}
