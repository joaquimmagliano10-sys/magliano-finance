import { z } from "zod";
import { slugify } from "./format";

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => u.startsWith("/") || /^https:\/\//.test(u), "URL de imagem inválida");

export const shirtInputSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome").max(80),
    slug: z.string().trim().max(60).optional().default(""),
    descricao: z.string().trim().max(600).default(""),
    preco: z.number().int("Preço em centavos").min(0).max(10_000_000),
    modelagem: z.enum(["slim", "regular", "oversized"]).default("regular"),
    tamanhos: z.array(z.string().trim().min(1).max(8)).min(1, "Escolha ao menos um tamanho").max(12),
    cores: z
      .array(
        z.object({
          id: z.string().trim().max(40).optional().default(""),
          nome: z.string().trim().min(1, "Nome da cor").max(40),
          hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
          imagem: imageUrl.nullable().optional(),
        }),
      )
      .min(1, "Cadastre ao menos uma cor")
      .max(16),
    fotos: z.array(imageUrl).max(12).default([]),
    estampaFrente: imageUrl.nullable().optional(),
    estampaCostas: imageUrl.nullable().optional(),
    padrao: imageUrl.nullable().optional(),
    estampaLargura: z.number().min(0.03).max(0.45).default(0.26),
    estampaPosicao: z.enum(["centro", "peito-esquerdo"]).default("centro"),
    padraoEscala: z.number().min(0.03).max(0.6).default(0.18),
    linkCompra: z.union([z.literal(""), z.string().trim().url("Link de compra inválido").max(500)]).default(""),
    ativo: z.boolean().default(true),
  })
  .transform((s) => ({
    ...s,
    slug: slugify(s.slug || s.nome),
    tamanhos: [...new Set(s.tamanhos.map((t) => t.toUpperCase()))],
    cores: s.cores.map((c, i) => ({ ...c, id: slugify(c.id || c.nome) || `cor-${i + 1}`, imagem: c.imagem ?? null })),
    estampaFrente: s.estampaFrente ?? null,
    estampaCostas: s.estampaCostas ?? null,
    padrao: s.padrao ?? null,
  }));

export type ShirtFormInput = z.input<typeof shirtInputSchema>;
