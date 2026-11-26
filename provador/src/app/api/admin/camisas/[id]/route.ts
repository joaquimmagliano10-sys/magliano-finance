import { prepareShirtInput } from "@/lib/admin-shirts";
import { requestOrigin } from "@/lib/assets";
import { requireAdmin } from "@/lib/auth";
import { repo } from "@/lib/db";
import { errorJson, json } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const prepared = await prepareShirtInput(await req.json().catch(() => null), requestOrigin(req));
  if (!prepared.ok) return errorJson(prepared.erro, 422);
  try {
    const shirt = await repo().updateShirt(id, prepared.input);
    return shirt ? json({ camisa: shirt }) : errorJson("Camisa não encontrada", 404);
  } catch (err) {
    return errorJson((err as Error).message, 409);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  return (await repo().deleteShirt(id)) ? json({ ok: true }) : errorJson("Camisa não encontrada", 404);
}
