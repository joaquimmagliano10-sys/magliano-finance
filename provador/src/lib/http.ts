import "server-only";
import { config } from "./config";
import { clientKey, limit, type Rule } from "./ratelimit";

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const errorJson = (mensagem: string, status = 400, extra: Record<string, unknown> = {}) => json({ erro: mensagem, ...extra }, status);

/** Requisições do modo loja trazem o token do quiosque e têm limite próprio (mais alto). */
export function isKiosk(req: Request): boolean {
  const t = req.headers.get("x-kiosk-token");
  return !!config.kioskToken && !!t && t === config.kioskToken;
}

export async function enforceLimit(req: Request, bucket: string, rule: Rule): Promise<Response | null> {
  const r = await limit(`${bucket}:${clientKey(req)}`, rule);
  if (r.ok) return null;
  const min = Math.ceil(r.resetSec / 60);
  return errorJson(
    `Você atingiu o limite de tentativas. Tente novamente em ${min <= 1 ? "1 minuto" : `${min} minutos`}.`,
    429,
    { tentarEmSegundos: r.resetSec },
  );
}
