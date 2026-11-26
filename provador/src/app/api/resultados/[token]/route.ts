import { enforceLimit, errorJson, json } from "@/lib/http";
import { deleteTempResult, readTempResult } from "@/lib/storage";

export const runtime = "nodejs";

/** GET /api/resultados/:token — imagem temporária (?baixar=1 força o download). */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limited = await enforceLimit(req, "resultados-get", { max: 120, windowSec: 600 });
  if (limited) return limited;
  const { token } = await ctx.params;
  const found = await readTempResult(token);
  if (!found) return errorJson("Este link expirou ou foi apagado.", 404);
  const download = new URL(req.url).searchParams.has("baixar");
  const body: BodyInit = Buffer.isBuffer(found.body) ? new Uint8Array(found.body) : (found.body as ReadableStream<Uint8Array>);
  return new Response(body, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="minha-prova.jpg"`,
    },
  });
}

/** DELETE /api/resultados/:token — o próprio cliente pode apagar antes do prazo. */
export async function DELETE(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limited = await enforceLimit(req, "resultados-del", { max: 30, windowSec: 600 });
  if (limited) return limited;
  const { token } = await ctx.params;
  const ok = await deleteTempResult(token);
  return json({ apagado: ok });
}
