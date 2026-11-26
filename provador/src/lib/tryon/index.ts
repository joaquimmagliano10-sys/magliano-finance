import "server-only";
import { config } from "../config";
import { falKlingProvider } from "./fal-kling";
import { fashnProvider } from "./fashn";
import { replicateProvider } from "./replicate";
import type { TryOnProvider } from "./types";

export const PROVIDERS: Record<string, TryOnProvider> = {
  fashn: fashnProvider,
  fal: falKlingProvider,
  replicate: replicateProvider,
};

/**
 * Provedor ativo:
 *  - TRYON_PROVIDER=fashn|fal|replicate força um provedor;
 *  - TRYON_PROVIDER=demo desliga a IA (prévia simulada no navegador);
 *  - "auto" (padrão) usa o primeiro com chave configurada, na ordem FASHN → fal.
 *    O Replicate (IDM-VTON, não comercial) nunca é escolhido automaticamente.
 */
export function activeProvider(): TryOnProvider | null {
  const choice = config.tryon.provider;
  if (choice === "demo") return null;
  if (choice !== "auto") {
    const p = PROVIDERS[choice];
    return p?.isConfigured() ? p : null;
  }
  return [fashnProvider, falKlingProvider].find((p) => p.isConfigured()) ?? null;
}

export function providerById(id: string): TryOnProvider | null {
  const p = PROVIDERS[id];
  return p && p.isConfigured() ? p : null;
}

/** Baixa o resultado do provedor (só https) para devolver ao navegador como data URI. */
export async function fetchResultImage(image: { url?: string; base64?: string }): Promise<{ mime: string; data: Buffer }> {
  if (image.base64) {
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(image.base64);
    if (m) return { mime: m[1], data: Buffer.from(m[2], "base64") };
    return { mime: "image/jpeg", data: Buffer.from(image.base64, "base64") };
  }
  const url = image.url ?? "";
  if (!url.startsWith("https://")) throw new Error("URL de resultado inválida");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Falha ao baixar resultado (${res.status})`);
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!mime.startsWith("image/")) throw new Error("Resultado não é imagem");
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > 15 * 1024 * 1024) throw new Error("Resultado grande demais");
  return { mime, data };
}
