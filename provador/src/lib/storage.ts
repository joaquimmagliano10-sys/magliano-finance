import "server-only";
import { del, get, list, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { config } from "./config";

/**
 * Arquivos do catálogo (fotos, estampas, texturas) e resultados temporários do
 * provador. Em produção usa Vercel Blob; localmente, a pasta .data/.
 */
const LOCAL_ROOT = join(process.cwd(), ".data");
const useBlob = () => !!config.blobToken;

export const randomToken = (bytes = 18) => randomBytes(bytes).toString("base64url");

// ───────────────────────── arquivos do catálogo (públicos) ─────────────────────────
export async function saveCatalogFile(name: string, data: Buffer, contentType: string): Promise<string> {
  const safe = name.replace(/[^a-z0-9._-]/gi, "-").slice(-60);
  const key = `catalogo/${Date.now().toString(36)}-${randomToken(6)}-${safe}`;
  if (useBlob()) {
    const r = await put(key, data, { access: "public", contentType, addRandomSuffix: false, token: config.blobToken });
    return r.url;
  }
  const file = join(LOCAL_ROOT, "uploads", key);
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, data);
  return `/api/arquivos/${key}`;
}

/** Lê um arquivo local servido por /api/arquivos (impede "../"). */
export async function readLocalUpload(path: string[]): Promise<Buffer | null> {
  const rel = normalize(path.join("/"));
  if (rel.startsWith("..") || rel.includes("\0")) return null;
  const file = join(LOCAL_ROOT, "uploads", rel);
  if (!file.startsWith(join(LOCAL_ROOT, "uploads"))) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

// ───────────────────────── resultados temporários (QR code da loja) ─────────────────────────
/**
 * Guardamos o resultado só pelo tempo necessário para o cliente baixar no
 * celular (RESULT_TTL_MINUTES, padrão 30 min, máximo 24 h). O nome do arquivo
 * carrega a data de expiração; a rota de leitura recusa arquivos vencidos e a
 * limpeza (cron diário + a cada novo envio) apaga o que passou do prazo.
 */
export interface TempMeta {
  token: string;
  expiresAt: number;
  shirtId: string;
}

const TEMP_PREFIX = "resultados/";
const parseTempName = (name: string): TempMeta | null => {
  const m = /([A-Za-z0-9_-]{20,})__(\d{10,})__([A-Za-z0-9_-]+)\.jpg$/.exec(name);
  return m ? { token: m[1], expiresAt: Number(m[2]), shirtId: m[3] } : null;
};

export async function saveTempResult(data: Buffer, shirtId: string): Promise<TempMeta> {
  const token = randomToken(24);
  const expiresAt = Date.now() + config.resultTtlMinutes * 60_000;
  const safeShirt = shirtId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "x";
  const name = `${token}__${expiresAt}__${safeShirt}.jpg`;
  if (useBlob()) {
    const opts = { contentType: "image/jpeg", addRandomSuffix: false, token: config.blobToken, ttlDays: 1 } as const;
    try {
      await put(TEMP_PREFIX + name, data, { ...opts, access: "private" });
    } catch {
      // loja de Blob só pública: o token aleatório de 24 bytes funciona como senha da URL
      await put(TEMP_PREFIX + name, data, { ...opts, access: "public" });
    }
  } else {
    await mkdir(join(LOCAL_ROOT, TEMP_PREFIX), { recursive: true });
    await writeFile(join(LOCAL_ROOT, TEMP_PREFIX, name), data);
  }
  void purgeExpiredResults().catch(() => undefined);
  return { token, expiresAt, shirtId: safeShirt };
}

async function findTemp(token: string): Promise<{ meta: TempMeta; ref: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  if (useBlob()) {
    const { blobs } = await list({ prefix: TEMP_PREFIX + token, token: config.blobToken, limit: 2 });
    const b = blobs[0];
    const meta = b && parseTempName(b.pathname);
    return meta && meta.token === token ? { meta, ref: b.url } : null;
  }
  try {
    const files = await readdir(join(LOCAL_ROOT, TEMP_PREFIX));
    const f = files.find((n) => n.startsWith(token + "__"));
    const meta = f && parseTempName(f);
    return meta ? { meta, ref: join(LOCAL_ROOT, TEMP_PREFIX, f!) } : null;
  } catch {
    return null;
  }
}

export async function getTempMeta(token: string): Promise<TempMeta | null> {
  const found = await findTemp(token);
  if (!found || found.meta.expiresAt < Date.now()) return null;
  return found.meta;
}

export async function readTempResult(token: string): Promise<{ meta: TempMeta; body: ReadableStream<Uint8Array> | Buffer } | null> {
  const found = await findTemp(token);
  if (!found || found.meta.expiresAt < Date.now()) return null;
  if (useBlob()) {
    for (const access of ["private", "public"] as const) {
      try {
        const r = await get(found.ref, { access, token: config.blobToken });
        if (r && r.statusCode === 200) return { meta: found.meta, body: r.stream };
      } catch {
        /* tenta o outro modo de acesso */
      }
    }
    return null;
  }
  return { meta: found.meta, body: await readFile(found.ref) };
}

export async function deleteTempResult(token: string): Promise<boolean> {
  const found = await findTemp(token);
  if (!found) return false;
  if (useBlob()) await del(found.ref, { token: config.blobToken });
  else await rm(found.ref, { force: true });
  return true;
}

/** Apaga resultados vencidos (e qualquer um com mais de 24 h, por garantia). */
export async function purgeExpiredResults(): Promise<number> {
  const now = Date.now();
  const hardLimit = now - 24 * 3600_000;
  let removed = 0;
  if (useBlob()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: TEMP_PREFIX, cursor, token: config.blobToken, limit: 1000 });
      const old = page.blobs.filter((b) => {
        const meta = parseTempName(b.pathname);
        return !meta || meta.expiresAt < now || new Date(b.uploadedAt).getTime() < hardLimit;
      });
      if (old.length) await del(old.map((b) => b.url), { token: config.blobToken });
      removed += old.length;
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return removed;
  }
  try {
    const dir = join(LOCAL_ROOT, TEMP_PREFIX);
    for (const f of await readdir(dir)) {
      const meta = parseTempName(f);
      const st = await stat(join(dir, f));
      if (!meta || meta.expiresAt < now || st.mtimeMs < hardLimit) {
        await rm(join(dir, f), { force: true });
        removed++;
      }
    }
  } catch {
    /* pasta ainda não existe */
  }
  return removed;
}
