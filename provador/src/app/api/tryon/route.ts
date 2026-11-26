import { isPublicHttps, loadAsset, requestOrigin } from "@/lib/assets";
import { appSecret, config } from "@/lib/config";
import { repo } from "@/lib/db";
import { enforceLimit, errorJson, isKiosk, json } from "@/lib/http";
import { ImageError, normalizePhoto, toDataUri } from "@/lib/image";
import { dailyCapRule, limit } from "@/lib/ratelimit";
import { signToken } from "@/lib/tokens";
import { activeProvider } from "@/lib/tryon";
import { ProviderError } from "@/lib/tryon/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/tryon — inicia uma prova.
 * Body (multipart): foto, camisaId, corId, consentimento=sim, origem=web|loja
 *
 * A foto é normalizada em memória (sem metadados) e enviada direto ao provedor
 * de IA. Nada é gravado em disco ou banco. A resposta traz um token assinado
 * para acompanhar o processamento em /api/tryon/status.
 */
export async function POST(req: Request) {
  const kiosk = isKiosk(req);
  const limited = await enforceLimit(req, kiosk ? "tryon-loja" : "tryon", kiosk ? config.tryon.kioskRateLimit : config.tryon.rateLimit);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson("Envio inválido.");
  }
  if (form.get("consentimento") !== "sim") {
    return errorJson("É preciso autorizar o uso da imagem para fazer a prova.", 403);
  }
  const file = form.get("foto");
  if (!(file instanceof Blob)) return errorJson("Envie uma foto.");
  if (file.size > config.tryon.maxUploadBytes) return errorJson("Imagem muito grande.", 413);

  const shirt = await repo().getShirt(String(form.get("camisaId") ?? ""));
  if (!shirt || !shirt.ativo) return errorJson("Camisa não encontrada.", 404);
  const color = shirt.cores.find((c) => c.id === form.get("corId")) ?? shirt.cores[0];
  const origem = form.get("origem") === "loja" ? "loja" : "web";

  let photo: Awaited<ReturnType<typeof normalizePhoto>>;
  try {
    photo = await normalizePhoto(Buffer.from(await file.arrayBuffer()), { maxBytes: config.tryon.maxUploadBytes, maxSide: 1280 });
  } catch (err) {
    if (err instanceof ImageError) return errorJson(err.message, err.status);
    return errorJson("Não foi possível ler a imagem.");
  }

  const provider = activeProvider();
  // Métrica simples: conta a prova (sem nenhum dado pessoal)
  await repo().recordEvent(shirt.id, "foto", origem).catch((e) => console.error("[metricas]", e));

  if (!provider) {
    // Sem API configurada: o navegador gera a prévia simulada localmente.
    return json({ modo: "demo" });
  }

  const cap = await limit("tryon-global-diario", dailyCapRule());
  if (!cap.ok) return errorJson("O provador atingiu o limite diário de provas com IA. Veja a prévia 3D ou tente amanhã.", 429);

  const garmentUrl = color.imagem || shirt.fotos[0];
  if (!garmentUrl) return errorJson("Esta camisa ainda não tem foto cadastrada.", 422);
  let garmentImage = garmentUrl;
  if (!isPublicHttps(garmentUrl)) {
    const asset = await loadAsset(garmentUrl, requestOrigin(req));
    if (!asset) return errorJson("Não foi possível carregar a foto da camisa.", 500);
    garmentImage = toDataUri(asset.data, asset.mime);
  }

  try {
    const ref = await provider.start({
      personImage: toDataUri(photo.data),
      garmentImage,
      garmentDescription: `${shirt.nome}, camiseta de manga curta na cor ${color.nome.toLowerCase()}`,
    });
    const job = signToken({ p: provider.id, r: ref, c: shirt.id }, appSecret(), config.tryon.jobTtlSec);
    return json({ modo: "ia", job, provedor: provider.label });
  } catch (err) {
    console.error("[tryon] falha ao iniciar:", (err as Error).message);
    const msg = err instanceof ProviderError ? err.userMessage : "Não foi possível iniciar a prova agora.";
    return errorJson(msg, 502, { podeUsarDemo: true });
  }
}
