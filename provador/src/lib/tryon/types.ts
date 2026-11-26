/**
 * Interface comum dos provedores de virtual try-on. Para trocar de provedor
 * basta implementar esta interface e registrá-la em ./index.ts — o resto do
 * app (rotas, telas) não muda.
 */
export interface TryOnInput {
  /** foto da pessoa: data URI (JPEG) já normalizado e sem metadados */
  personImage: string;
  /** imagem da peça: URL https pública ou data URI */
  garmentImage: string;
  /** descrição curta da peça (alguns modelos usam como prompt) */
  garmentDescription: string;
}

/** Dados que o provedor precisa para consultar o job depois (vão assinados no token). */
export type JobRef = Record<string, string>;

export type JobStatus =
  | { state: "processing" }
  | { state: "completed"; image: { url?: string; base64?: string } }
  | { state: "failed"; error: string };

export interface TryOnProvider {
  id: string;
  label: string;
  /** custo aproximado por imagem em US$, só para exibição no admin/README */
  approxCostUsd: number;
  isConfigured(): boolean;
  start(input: TryOnInput, signal?: AbortSignal): Promise<JobRef>;
  status(ref: JobRef, signal?: AbortSignal): Promise<JobStatus>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public userMessage = "O serviço de prova virtual está indisponível no momento. Tente de novo em instantes.",
    public status = 502,
  ) {
    super(message);
  }
}

/** fetch com tempo limite e erro legível. */
export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 30_000);
  init.signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const msg = typeof body === "object" && body ? JSON.stringify(body).slice(0, 300) : String(text).slice(0, 300);
      const err = new ProviderError(`HTTP ${res.status} em ${new URL(url).host}: ${msg}`);
      if (res.status === 429) err.userMessage = "Muita gente provando agora. Tente de novo em alguns segundos.";
      if (res.status === 401 || res.status === 403) err.userMessage = "O provador está sem credenciais válidas. Avise a loja.";
      throw err;
    }
    return body as T;
  } finally {
    clearTimeout(t);
  }
}
