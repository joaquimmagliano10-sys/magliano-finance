import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens assinados (HMAC-SHA256) para identificar jobs de try-on.
 * O cliente só recebe um token opaco; sem a assinatura válida ninguém consegue
 * consultar o resultado de outra pessoa nem apontar o servidor para outra URL.
 */
export function signToken<T extends object>(payload: T, secret: string, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends object>(token: string, secret: string): (T & { exp: number }) | null {
  if (typeof token !== "string" || token.length > 4096) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}
