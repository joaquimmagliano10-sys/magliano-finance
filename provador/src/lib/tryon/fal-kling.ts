import { config } from "../config";
import { fetchJson, type JobRef, type JobStatus, ProviderError, type TryOnInput, type TryOnProvider } from "./types";

/**
 * Kling Kolors Virtual Try-On via fal.ai (fila assíncrona).
 *
 * POST https://queue.fal.run/<modelo>  (Authorization: Key <FAL_KEY>)
 *   → { request_id, status_url, response_url }
 * GET status_url → { status: IN_QUEUE | IN_PROGRESS | COMPLETED }
 * GET response_url → { image: { url } }
 *
 * As URLs de status/resultado vêm na resposta e são guardadas no token
 * assinado; antes de usá-las conferimos que apontam para queue.fal.run.
 */
const QUEUE = "https://queue.fal.run/";

type SubmitResponse = { request_id?: string; status_url?: string; response_url?: string };
type StatusResponse = { status?: string; error?: string };
type ResultResponse = { image?: { url?: string }; images?: Array<{ url?: string }>; detail?: unknown };

const safeQueueUrl = (u: string | undefined) => (u && u.startsWith(QUEUE) && !u.includes("..") ? u : null);

export const falKlingProvider: TryOnProvider = {
  id: "fal",
  label: "Kling Kolors (fal.ai)",
  approxCostUsd: 0.07,
  isConfigured: () => !!config.fal.key,

  async start(input: TryOnInput, signal?: AbortSignal): Promise<JobRef> {
    const r = await fetchJson<SubmitResponse>(QUEUE + config.fal.model, {
      method: "POST",
      headers: { Authorization: `Key ${config.fal.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ human_image_url: input.personImage, garment_image_url: input.garmentImage }),
      signal,
      timeoutMs: 45_000,
    });
    const statusUrl = safeQueueUrl(r.status_url);
    const responseUrl = safeQueueUrl(r.response_url);
    if (!r.request_id || !statusUrl || !responseUrl) throw new ProviderError("fal.ai: resposta de fila inesperada");
    return { id: r.request_id, s: statusUrl, r: responseUrl };
  },

  async status(ref: JobRef, signal?: AbortSignal): Promise<JobStatus> {
    const statusUrl = safeQueueUrl(ref.s);
    const responseUrl = safeQueueUrl(ref.r);
    if (!statusUrl || !responseUrl) return { state: "failed", error: "job inválido" };
    const headers = { Authorization: `Key ${config.fal.key}` };
    const st = await fetchJson<StatusResponse>(statusUrl, { headers, signal, timeoutMs: 20_000 });
    if (st.status === "COMPLETED") {
      const res = await fetchJson<ResultResponse>(responseUrl, { headers, signal, timeoutMs: 30_000 });
      const url = res.image?.url ?? res.images?.[0]?.url;
      return url ? { state: "completed", image: { url } } : { state: "failed", error: "A prova não pôde ser gerada. Tente outra foto." };
    }
    if (st.status === "IN_QUEUE" || st.status === "IN_PROGRESS") return { state: "processing" };
    return { state: "failed", error: "A prova não pôde ser gerada. Tente outra foto." };
  },
};
