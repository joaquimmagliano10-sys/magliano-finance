import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "./session";

export async function checkCredentials(email: string, password: string): Promise<boolean> {
  const emailOk = email.trim().toLowerCase() === config.admin.email;
  let passOk = false;
  if (config.admin.passwordHash) {
    passOk = await bcrypt.compare(password, config.admin.passwordHash);
  } else if (config.admin.password) {
    const a = Buffer.from(password);
    const b = Buffer.from(config.admin.password);
    passOk = a.length === b.length && timingSafeEqual(a, b);
  }
  return emailOk && passOk;
}

export async function startSession(email: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentAdmin() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Para rotas de API do admin: lança 401 se não houver sessão. */
export async function requireAdmin() {
  const s = await currentAdmin();
  if (!s) throw new Response(JSON.stringify({ erro: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
  return s;
}

export const adminConfigWarning = () =>
  !config.admin.passwordHash && !config.admin.password
    ? "Defina ADMIN_PASSWORD_HASH (ou ADMIN_PASSWORD) para acessar o painel."
    : !config.admin.passwordHash && config.isProd
      ? "Usando ADMIN_PASSWORD em texto. Prefira ADMIN_PASSWORD_HASH (npm run hash-senha)."
      : null;
