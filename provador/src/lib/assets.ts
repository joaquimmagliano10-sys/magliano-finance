import "server-only";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { readLocalUpload } from "./storage";

/**
 * Lê os bytes de uma imagem do catálogo, venha ela de:
 *  - /api/arquivos/... (upload local em .data/uploads)
 *  - /seed/... ou outro arquivo de public/ (lido do disco; na Vercel, via HTTP)
 *  - https://... (Vercel Blob ou outro host)
 */
export async function loadAsset(url: string, origin: string): Promise<{ data: Buffer; mime: string } | null> {
  const mimeOf = (u: string) => (/\.png($|\?)/i.test(u) ? "image/png" : /\.webp($|\?)/i.test(u) ? "image/webp" : "image/jpeg");
  try {
    if (url.startsWith("/api/arquivos/")) {
      const parts = url.replace("/api/arquivos/", "").split("/").map(decodeURIComponent);
      const data = await readLocalUpload(parts);
      return data ? { data, mime: mimeOf(url) } : null;
    }
    if (url.startsWith("/")) {
      const rel = normalize(url).replace(/^(\.\.[/\\])+/, "");
      try {
        return { data: await readFile(join(process.cwd(), "public", rel)), mime: mimeOf(url) };
      } catch {
        url = new URL(url, origin).toString();
      }
    }
    if (!/^https?:\/\//.test(url)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || mimeOf(url);
    return { data: Buffer.from(await res.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

/** Origem pública da requisição (para montar URLs absolutas). */
export function requestOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const isPublicHttps = (url: string) => /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url);
