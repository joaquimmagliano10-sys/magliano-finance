import { jwtVerify, SignJWT } from "jose";

/**
 * Sessão do painel administrativo: JWT HS256 em cookie httpOnly.
 * Este arquivo não usa APIs exclusivas do Node para poder rodar no proxy.ts.
 */
export const SESSION_COOKIE = "prov_admin";
export const SESSION_HOURS = 8;

const DEV_SECRET = "dev-secret-nao-use-em-producao-0123456789abcdef";

function key(): Uint8Array {
  const s = process.env.APP_SECRET && process.env.APP_SECRET.length >= 32 ? process.env.APP_SECRET : DEV_SECRET;
  return new TextEncoder().encode(`admin-session:${s}`);
}

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ sub: email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.role === "admin" && typeof payload.sub === "string" ? { email: payload.sub } : null;
  } catch {
    return null;
  }
}
