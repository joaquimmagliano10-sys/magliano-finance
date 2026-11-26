import "server-only";
import { loadAsset } from "./assets";
import { renderGarment } from "./garment-render";
import { shirtInputSchema } from "./shirt-schema";
import { saveCatalogFile } from "./storage";
import type { ShirtInput } from "./types";

/**
 * Valida o formulário e completa o que faltar: cores sem foto recebem uma
 * imagem "flat lay" gerada a partir da cor + estampa (necessária para a IA de
 * try-on), e a galeria recebe a primeira foto se estiver vazia.
 */
export async function prepareShirtInput(raw: unknown, origin: string): Promise<{ ok: true; input: ShirtInput } | { ok: false; erro: string }> {
  const parsed = shirtInputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, erro: `${first.path.join(".") || "dados"}: ${first.message}` };
  }
  const s = parsed.data;
  const missing = s.cores.filter((c) => !c.imagem);
  if (missing.length) {
    const [front, pattern] = await Promise.all([
      s.estampaFrente ? loadAsset(s.estampaFrente, origin) : null,
      s.padrao ? loadAsset(s.padrao, origin) : null,
    ]);
    for (const c of missing) {
      const png = await renderGarment({
        hex: c.hex,
        estampaFrente: front?.data ?? null,
        padrao: pattern?.data ?? null,
        padraoEscala: s.padraoEscala,
        estampaLargura: s.estampaLargura,
        estampaPosicao: s.estampaPosicao,
      });
      const sharp = (await import("sharp")).default;
      const jpg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      c.imagem = await saveCatalogFile(`${s.slug}-${c.id}-gerada.jpg`, jpg, "image/jpeg");
    }
  }
  const fotos = s.fotos.length ? s.fotos : s.cores[0].imagem ? [s.cores[0].imagem] : [];
  return { ok: true, input: { ...s, fotos } };
}
