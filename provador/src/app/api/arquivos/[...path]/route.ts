import { readLocalUpload } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** Serve os arquivos do catálogo enviados pelo admin quando não há Vercel Blob (uso local). */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const data = await readLocalUpload(path);
  if (!data) return new Response("Não encontrado", { status: 404 });
  const ext = path[path.length - 1].split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
