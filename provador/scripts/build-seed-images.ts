/**
 * Gera as 3 camisas de exemplo:
 *  - estampas/padrões (PNG com transparência) em public/seed/
 *  - fotos "flat lay" de cada cor (usadas no catálogo e enviadas à IA de try-on)
 *  - seed/camisas.json (dados iniciais do catálogo)
 *
 * Uso: npm run gerar:imagens
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { renderGarment } from "../src/lib/garment-render";
import type { ShirtInput } from "../src/lib/types";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "seed");
mkdirSync(OUT, { recursive: true });
mkdirSync(join(ROOT, "seed"), { recursive: true });

const GOLD = "#c7a96b";
const svgPng = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();

async function save(name: string, buf: Buffer) {
  writeFileSync(join(OUT, name), buf);
  return `/seed/${name}`;
}

// ── Estampas
const monogram = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <circle cx="200" cy="200" r="176" fill="none" stroke="${GOLD}" stroke-width="16"/>
  <circle cx="200" cy="200" r="146" fill="none" stroke="${GOLD}" stroke-width="4"/>
  <text x="200" y="262" text-anchor="middle" font-family="Inter Display, Inter" font-weight="800" font-size="190" fill="${GOLD}">V</text>
</svg>`;

const stripes = [500, 540, 576, 608, 636, 660, 680]
  .map((y, i) => `<rect x="0" y="${y}" width="1000" height="${8 + i * 3}" fill="#000"/>`)
  .join("");
const sunset = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1080">
  <defs>
    <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#f7cf5a"/><stop offset="0.5" stop-color="#f08a3c"/><stop offset="1" stop-color="#d23f2a"/>
    </linearGradient>
    <mask id="m"><rect width="1000" height="1080" fill="#fff"/>${stripes}</mask>
  </defs>
  <circle cx="500" cy="420" r="330" fill="url(#g)" mask="url(#m)"/>
  <rect x="90" y="742" width="820" height="10" fill="${GOLD}"/>
  <text x="500" y="900" text-anchor="middle" font-family="Inter Display, Inter" font-weight="800" font-size="150" letter-spacing="6" fill="${GOLD}">SOL POENTE</text>
  <text x="500" y="985" text-anchor="middle" font-family="Inter" font-weight="600" font-size="46" letter-spacing="14" fill="${GOLD}">COLEÇÃO VERÃO · 2026</text>
</svg>`;

const backText = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760">
  <circle cx="500" cy="120" r="90" fill="#f08a3c"/>
  <rect x="380" y="150" width="240" height="14" fill="#000" opacity="0"/>
  <text x="500" y="380" text-anchor="middle" font-family="Inter Display, Inter" font-weight="800" font-size="160" letter-spacing="4" fill="${GOLD}">FEITO PARA</text>
  <text x="500" y="560" text-anchor="middle" font-family="Inter Display, Inter" font-weight="800" font-size="200" letter-spacing="10" fill="${GOLD}">VESTIR</text>
  <text x="500" y="680" text-anchor="middle" font-family="Inter" font-weight="600" font-size="44" letter-spacing="16" fill="${GOLD}">SÃO PAULO · BRASIL</text>
</svg>`;

const gridTile = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
  <path d="M0 0.5 H256 M0.5 0 V256" stroke="#000" stroke-opacity="0.28" stroke-width="3"/>
  <path d="M0 3 H256 M3 0 V256" stroke="#fff" stroke-opacity="0.22" stroke-width="2"/>
  <path d="M128 112 V144 M112 128 H144" stroke="#000" stroke-opacity="0.35" stroke-width="5"/>
  <path d="M128 112 V144 M112 128 H144" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
  <circle cx="64" cy="64" r="3" fill="#fff" fill-opacity="0.3"/>
  <circle cx="192" cy="192" r="3" fill="#fff" fill-opacity="0.3"/>
</svg>`;

type Seed = ShirtInput & { id: string };

async function main() {
  const monoBuf = await svgPng(monogram);
  const sunBuf = await svgPng(sunset);
  const backBuf = await svgPng(backText);
  const gridBuf = await svgPng(gridTile);
  const monoUrl = await save("essencial-logo.png", monoBuf);
  const sunUrl = await save("sol-poente-frente.png", sunBuf);
  const backUrl = await save("sol-poente-costas.png", backBuf);
  const gridUrl = await save("grid-padrao.png", gridBuf);

  const shirts: Seed[] = [
    {
      id: "essencial",
      slug: "camiseta-essencial",
      nome: "Camiseta Essencial",
      descricao: "Algodão penteado 30.1, toque macio e gola canelada que não deforma. O básico que combina com tudo, com o monograma bordado no peito.",
      preco: 8990,
      modelagem: "regular",
      tamanhos: ["P", "M", "G", "GG", "XGG"],
      cores: [
        { id: "preto", nome: "Preto", hex: "#17191d" },
        { id: "off-white", nome: "Off-white", hex: "#f1eee7" },
        { id: "areia", nome: "Areia", hex: "#d6c4a2" },
        { id: "musgo", nome: "Verde musgo", hex: "#4a5a3c" },
      ],
      fotos: [],
      estampaFrente: monoUrl,
      estampaCostas: null,
      padrao: null,
      estampaLargura: 0.085,
      estampaPosicao: "peito-esquerdo",
      padraoEscala: 0.18,
      linkCompra: "https://exemplo.com.br/produtos/camiseta-essencial",
      ativo: true,
    },
    {
      id: "sol-poente",
      slug: "camiseta-sol-poente",
      nome: "Camiseta Sol Poente",
      descricao: "Estampa em silk de alta definição na frente e nas costas. Malha 100% algodão com caimento reto e barra dupla.",
      preco: 12990,
      modelagem: "regular",
      tamanhos: ["P", "M", "G", "GG"],
      cores: [
        { id: "off-white", nome: "Off-white", hex: "#efe9dd" },
        { id: "preto", nome: "Preto", hex: "#17191d" },
        { id: "marinho", nome: "Azul marinho", hex: "#1f2a44" },
      ],
      fotos: [],
      estampaFrente: sunUrl,
      estampaCostas: backUrl,
      padrao: null,
      estampaLargura: 0.27,
      estampaPosicao: "centro",
      padraoEscala: 0.18,
      linkCompra: "https://exemplo.com.br/produtos/camiseta-sol-poente",
      ativo: true,
    },
    {
      id: "grid-oversized",
      slug: "camiseta-grid-oversized",
      nome: "Camiseta Grid Oversized",
      descricao: "Modelagem oversized com ombro levemente caído e estampa corrida geométrica. Malha encorpada de 240 g/m².",
      preco: 14990,
      modelagem: "oversized",
      tamanhos: ["P", "M", "G", "GG"],
      cores: [
        { id: "grafite", nome: "Grafite", hex: "#2b2e33" },
        { id: "dourado", nome: "Dourado", hex: "#c7a96b" },
        { id: "verde-agua", nome: "Verde água", hex: "#9fc9be" },
      ],
      fotos: [],
      estampaFrente: null,
      estampaCostas: null,
      padrao: gridUrl,
      estampaLargura: 0.26,
      estampaPosicao: "centro",
      padraoEscala: 0.12,
      linkCompra: "https://exemplo.com.br/produtos/camiseta-grid-oversized",
      ativo: true,
    },
  ];

  for (const s of shirts) {
    for (const c of s.cores) {
      const png = await renderGarment({
        hex: c.hex,
        estampaFrente: s.estampaFrente ? (s.estampaFrente === monoUrl ? monoBuf : sunBuf) : null,
        padrao: s.padrao ? gridBuf : null,
        padraoEscala: s.padraoEscala,
        estampaLargura: s.estampaLargura,
        estampaPosicao: s.estampaPosicao,
      });
      // JPEG para a foto do produto (menor); a IA aceita JPEG/PNG
      const jpg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      c.imagem = await save(`${s.id}-${c.id}.jpg`, jpg);
    }
    s.fotos = [s.cores[0].imagem!];
  }

  writeFileSync(join(ROOT, "seed", "camisas.json"), JSON.stringify(shirts, null, 2) + "\n");
  console.log(`✔ ${shirts.length} camisas de exemplo em seed/camisas.json e imagens em public/seed/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
