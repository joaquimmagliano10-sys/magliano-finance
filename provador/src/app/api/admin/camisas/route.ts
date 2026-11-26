import { prepareShirtInput } from "@/lib/admin-shirts";
import { requestOrigin } from "@/lib/assets";
import { requireAdmin } from "@/lib/auth";
import { repo } from "@/lib/db";
import { errorJson, json } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  return json({ camisas: await repo().listShirts({ includeInactive: true }) });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const prepared = await prepareShirtInput(await req.json().catch(() => null), requestOrigin(req));
  if (!prepared.ok) return errorJson(prepared.erro, 422);
  try {
    const shirt = await repo().createShirt(prepared.input);
    return json({ camisa: shirt }, 201);
  } catch (err) {
    return errorJson((err as Error).message, 409);
  }
}
