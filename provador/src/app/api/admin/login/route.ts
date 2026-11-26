import { checkCredentials, startSession } from "@/lib/auth";
import { enforceLimit, errorJson, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = await enforceLimit(req, "login", { max: 8, windowSec: 600 });
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { email?: string; senha?: string } | null;
  if (!body?.email || !body?.senha) return errorJson("Informe e-mail e senha.");
  if (!(await checkCredentials(body.email, body.senha))) {
    await new Promise((r) => setTimeout(r, 400));
    return errorJson("E-mail ou senha incorretos.", 401);
  }
  await startSession(body.email.toLowerCase());
  return json({ ok: true });
}
