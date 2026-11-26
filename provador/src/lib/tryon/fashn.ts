import { config } from "../config";
import { fetchJson, type JobRef, type JobStatus, ProviderError, type TryOnInput, type TryOnProvider } from "./types";

/**
 * FASHN AI — https://fashn.ai (API própria; também disponível via fal.ai).
 *
 * Fluxo: POST /v1/run → { id } ; depois GET /v1/status/{id} até "completed".
 * Imagens podem ir como URL ou data URI (base64). Pedimos `return_base64` para
 * receber o resultado direto na resposta, sem depender de link no CDN deles.
 *
 * Referência: https://docs.fashn.ai (confira lá os parâmetros atuais do modelo
 * escolhido em FASHN_MODEL — padrão "tryon-v1.6").
 */
const BASE = "https://api.fashn.ai/v1";

type RunResponse = { id?: string; error?: unknown };
type StatusResponse = {
  id: string;
  status: "starting" | "in_queue" | "processing" | "completed" | "failed" | "canceled";
  output?: string[] | null;
  error?: { name?: string; message?: string } | string | null;
};

export const fashnProvider: TryOnProvider = {
  id: "fashn",
  label: "FASHN AI",
  approxCostUsd: 0.075,
  isConfigured: () => !!config.fashn.apiKey,

  async start(input: TryOnInput, signal?: AbortSignal): Promise<JobRef> {
    const body = {
      model_name: config.fashn.model,
      inputs: {
        model_image: input.personImage,
        garment_image: input.garmentImage,
        category: "tops",
        mode: config.fashn.mode,
        garment_photo_type: "auto",
        moderation_level: "permissive",
        output_format: "jpeg",
        return_base64: true,
      },
    };
    const r = await fetchJson<RunResponse>(`${BASE}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.fashn.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
      timeoutMs: 45_000,
    });
    if (!r?.id) throw new ProviderError(`FASHN não retornou id: ${JSON.stringify(r?.error ?? r).slice(0, 200)}`);
    return { id: r.id };
  },

  async status(ref: JobRef, signal?: AbortSignal): Promise<JobStatus> {
    if (!/^[A-Za-z0-9_-]{4,100}$/.test(ref.id ?? "")) return { state: "failed", error: "job inválido" };
    const r = await fetchJson<StatusResponse>(`${BASE}/status/${ref.id}`, {
      headers: { Authorization: `Bearer ${config.fashn.apiKey}` },
      signal,
      timeoutMs: 20_000,
    });
    if (r.status === "completed") {
      const out = r.output?.[0];
      if (!out) return { state: "failed", error: "Resposta sem imagem." };
      return out.startsWith("data:") ? { state: "completed", image: { base64: out } } : { state: "completed", image: { url: out } };
    }
    if (r.status === "failed" || r.status === "canceled") {
      const e = r.error;
      const msg = typeof e === "string" ? e : e?.message || e?.name || "Falha no processamento.";
      return { state: "failed", error: humanizeFashnError(msg, typeof e === "object" ? e?.name : undefined) };
    }
    return { state: "processing" };
  },
};

function humanizeFashnError(msg: string, name?: string): string {
  const n = (name || msg).toLowerCase();
  if (n.includes("pose") || n.includes("person") || n.includes("human")) return "Não encontramos uma pessoa bem enquadrada na foto. Tente de frente, com o tronco visível.";
  if (n.includes("moderation") || n.includes("nsfw")) return "A foto foi recusada pela moderação automática. Tente outra foto.";
  if (n.includes("image") && n.includes("load")) return "Não foi possível ler a imagem enviada.";
  return "A prova não pôde ser gerada desta vez. Tente outra foto ou tente novamente.";
}
