/**
 * Identidade da loja. Troque aqui (ou pelas variáveis NEXT_PUBLIC_*) o nome,
 * contatos e textos. As cores ficam em src/app/globals.css (bloco @theme) e o
 * logo em src/components/Logo.tsx / public/logo.svg.
 *
 * A paleta padrão (grafite #17191d + dourado #c7a96b) foi tirada do index.html
 * que já existe neste repositório.
 */
export const BRAND = {
  nome: process.env.NEXT_PUBLIC_STORE_NAME || "VESTE",
  slogan: process.env.NEXT_PUBLIC_STORE_SLOGAN || "Prove antes de comprar.",
  descricao:
    "Camisas com estilo de rua e acabamento premium. Tire uma foto, veja a peça em você e gire em 360°.",
  cidade: process.env.NEXT_PUBLIC_STORE_CITY || "São Paulo – SP",
  site: process.env.NEXT_PUBLIC_SITE_URL || "",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM || "",
  /** Dados para a Política de Privacidade (LGPD) — preencha com os dados reais. */
  razaoSocial: process.env.NEXT_PUBLIC_RAZAO_SOCIAL || "[RAZÃO SOCIAL DA LOJA]",
  cnpj: process.env.NEXT_PUBLIC_CNPJ || "[CNPJ]",
  emailPrivacidade: process.env.NEXT_PUBLIC_EMAIL_PRIVACIDADE || "privacidade@sualoja.com.br",
  encarregado: process.env.NEXT_PUBLIC_ENCARREGADO_LGPD || "[NOME DO ENCARREGADO (DPO)]",
};
