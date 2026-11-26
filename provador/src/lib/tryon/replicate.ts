import { config } from "../config";
import { fetchJson, type JobRef, type JobStatus, ProviderError, type TryOnInput, type TryOnProvider } from "./types";

/**
 * IDM-VTON no Replicate (modelo de código aberto, p.ex. "cuuupid/idm-vton").
 *
 * ⚠️ LICENÇA: o IDM-VTON é distribuído para USO NÃO COMERCIAL (CC BY-NC-SA).
 * Use este provedor só para testes/desenvolvimento. Para a loja, use FASHN ou
 * Kling (licenças comerciais).
 *
 * Defina REPLICATE_MODEL_VERSION com o hash da versão (aba "API" do modelo).
 */
const BASE = "https://api.replicate.com/v1/predictions";

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
};

export const replicateProvider: TryOnProvider = {
  id: "replicate",
  label: "IDM-VTON (Replicate) — só testes",
  approxCostUsd: 0.025,
  isConfigured: () => !!config.replicate.token && !!config.replicate.version,

  async start(input: TryOnInput, signal?: AbortSignal): Promise<JobRef> {
    const r = await fetchJson<Prediction>(BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.replicate.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: config.replicate.version,
        input: {
          human_img: input.personImage,
          garm_img: input.garmentImage,
          garment_des: input.garmentDescription,
          category: "upper_body",
          crop: false,
          steps: 30,
          seed: 42,
        },
      }),
      signal,
      timeoutMs: 45_000,
    });
    if (!r?.id) throw new ProviderError("Replicate não retornou id");
    return { id: r.id };
  },

  async status(ref: JobRef, signal?: AbortSignal): Promise<JobStatus> {
    if (!/^[a-z0-9]{6,64}$/i.test(ref.id ?? "")) return { state: "failed", error: "job inválido" };
    const r = await fetchJson<Prediction>(`${BASE}/${ref.id}`, {
      headers: { Authorization: `Bearer ${config.replicate.token}` },
      signal,
      timeoutMs: 20_000,
    });
    if (r.status === "succeeded") {
      const url = Array.isArray(r.output) ? r.output[0] : r.output;
      return url ? { state: "completed", image: { url } } : { state: "failed", error: "Resposta sem imagem." };
    }
    if (r.status === "failed" || r.status === "canceled") return { state: "failed", error: "A prova não pôde ser gerada. Tente outra foto." };
    return { state: "processing" };
  },
};
