import type { Modelagem } from "./sizes";

export interface ShirtColor {
  id: string;
  nome: string;
  hex: string;
  /** Foto da peça nesta cor (de preferência "flat lay" em fundo claro). Usada pela IA de try-on. */
  imagem?: string | null;
}

export type PrintPosition = "centro" | "peito-esquerdo";

export interface Shirt {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  /** preço em centavos */
  preco: number;
  modelagem: Modelagem;
  tamanhos: string[];
  cores: ShirtColor[];
  /** galeria de fotos do produto */
  fotos: string[];
  /** PNG com transparência aplicado na frente do modelo 3D */
  estampaFrente?: string | null;
  estampaCostas?: string | null;
  /** textura que se repete pela peça inteira (estampa corrida) */
  padrao?: string | null;
  /** largura da estampa da frente/costas no tecido, em metros */
  estampaLargura: number;
  estampaPosicao: PrintPosition;
  /** tamanho de cada repetição do padrão, em metros */
  padraoEscala: number;
  linkCompra: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export type ShirtInput = Omit<Shirt, "id" | "criadoEm" | "atualizadoEm">;

export type EventKind = "foto" | "360";
export type EventSource = "web" | "loja";

export interface StatsRow {
  shirtId: string;
  nome: string;
  foto: number;
  v360: number;
  total: number;
}

export interface Stats {
  perShirt: StatsRow[];
  daily: Array<{ dia: string; total: number }>;
  totals: { hoje: number; semana: number; total: number; loja: number };
}

/** Camisa "pública" enviada ao navegador (sem campos internos). */
export type PublicShirt = Omit<Shirt, "criadoEm" | "atualizadoEm" | "ativo">;

export const toPublicShirt = (s: Shirt): PublicShirt => {
  const { criadoEm: _c, atualizadoEm: _a, ativo: _t, ...rest } = s;
  void _c;
  void _a;
  void _t;
  return rest;
};
