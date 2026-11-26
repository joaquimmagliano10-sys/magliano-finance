import type { PublicShirt } from "../types";
import type { ShirtTextureSpec } from "./shirt-texture";

export function textureFor(shirt: PublicShirt | undefined | null, colorId: string | null | undefined): ShirtTextureSpec | null {
  if (!shirt) return null;
  const color = shirt.cores.find((c) => c.id === colorId) ?? shirt.cores[0];
  if (!color) return null;
  return {
    hex: color.hex,
    estampaFrente: shirt.estampaFrente,
    estampaCostas: shirt.estampaCostas,
    padrao: shirt.padrao,
    padraoEscala: shirt.padraoEscala,
    estampaLargura: shirt.estampaLargura,
    estampaPosicao: shirt.estampaPosicao,
  };
}
