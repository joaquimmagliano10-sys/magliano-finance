/**
 * Gera os modelos 3D base em public/models:
 *   - manequim-masculino.glb / manequim-feminino.glb  (corpo + calça + tênis)
 *   - camiseta-base.glb  (nós "Camiseta_masculino" e "Camiseta_feminino")
 *   - camiseta-uv-guia.png  (guia do atlas de textura para designers)
 *
 * Cada malha traz morph targets (ombros/peito/cintura/quadril ± e, na camiseta,
 * folga ±). O visualizador ajusta as influências conforme as medidas estimadas
 * do cliente e o tamanho escolhido — assim um único modelo de camiseta serve
 * para todas as camisas do catálogo (só a textura muda).
 *
 * Uso: npm run gerar:modelos
 */
import { Document, NodeIO, type Primitive } from "@gltf-transform/core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { countVertices, generateBody, generateShirt, getShirtLayout, type GeneratedModel } from "../src/lib/body/parametric";
import {
  BASE_BODY,
  BASE_FOLGA,
  BODY_MORPHS,
  type BodyMeasurements,
  type MorphDef,
  SHIRT_MORPHS,
  type Sexo,
  UV_ATLAS_METERS,
  UV_LAYOUT,
} from "../src/lib/body/types";

const OUT = join(process.cwd(), "public", "models");
mkdirSync(OUT, { recursive: true });

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hex = (h: string): [number, number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255), 1];
};

function withMeasure(base: BodyMeasurements, def: MorphDef): BodyMeasurements {
  if (def.key === "folga") return base;
  return { ...base, [def.key]: base[def.key] + def.delta };
}

function addMesh(
  doc: Document,
  name: string,
  gen: (m: BodyMeasurements, folga: number) => GeneratedModel,
  sexo: Sexo,
  morphs: MorphDef[],
  materials: Record<string, ReturnType<Document["createMaterial"]>>,
) {
  const buffer = doc.getRoot().listBuffers()[0];
  const base = BASE_BODY[sexo];
  const folga0 = BASE_FOLGA[sexo];
  const model = gen(base, folga0);
  const variants = morphs.map((d) => gen(withMeasure(base, d), d.key === "folga" ? folga0 + d.delta : folga0));
  const mesh = doc.createMesh(name);
  for (const [primName, data] of Object.entries(model.primitives)) {
    const vcount = data.positions.length / 3;
    const acc = (type: "VEC3" | "VEC2" | "SCALAR", arr: Float32Array | Uint16Array | Uint32Array) =>
      doc.createAccessor().setType(type).setArray(arr as Float32Array<ArrayBuffer>).setBuffer(buffer);
    const prim: Primitive = doc
      .createPrimitive()
      .setAttribute("POSITION", acc("VEC3", data.positions))
      .setAttribute("NORMAL", acc("VEC3", data.normals))
      .setAttribute("TEXCOORD_0", acc("VEC2", data.uvs))
      .setIndices(acc("SCALAR", vcount < 65535 ? Uint16Array.from(data.indices) : data.indices))
      .setMaterial(materials[primName]);
    morphs.forEach((def, k) => {
      const other = variants[k].primitives[primName];
      if (other.positions.length !== data.positions.length) throw new Error(`Topologia diferente em ${name}/${def.name}`);
      const delta = new Float32Array(data.positions.length);
      for (let i = 0; i < delta.length; i++) delta[i] = other.positions[i] - data.positions[i];
      prim.addTarget(doc.createPrimitiveTarget(def.name).setAttribute("POSITION", acc("VEC3", delta)));
    });
    mesh.addPrimitive(prim);
  }
  mesh.setWeights(morphs.map(() => 0)).setExtras({ targetNames: morphs.map((d) => d.name) });
  const node = doc.createNode(name).setMesh(mesh);
  console.log(`  ${name}: ${countVertices(model)} vértices, ${morphs.length} morph targets`);
  return node;
}

async function main() {
  const io = new NodeIO();

  for (const sexo of ["masculino", "feminino"] as const) {
    const doc = new Document();
    doc.createBuffer();
    const materials = {
      pele: doc.createMaterial("Manequim").setBaseColorFactor(hex("#e9e4dc")).setRoughnessFactor(0.42).setMetallicFactor(0),
      calca: doc.createMaterial("Calca").setBaseColorFactor(hex("#2a2f3a")).setRoughnessFactor(0.92).setMetallicFactor(0),
      tenis: doc.createMaterial("Tenis").setBaseColorFactor(hex("#f2f2f0")).setRoughnessFactor(0.6).setMetallicFactor(0),
    };
    const node = addMesh(doc, "Manequim", generateBody, sexo, BODY_MORPHS, materials);
    doc.createScene("Manequim").addChild(node);
    doc.getRoot().getAsset().generator = "provador-virtual/build-models";
    const file = join(OUT, `manequim-${sexo}.glb`);
    writeFileSync(file, await io.writeBinary(doc));
    console.log(`✔ ${file}`);
  }

  {
    const doc = new Document();
    doc.createBuffer();
    const tecido = doc.createMaterial("Tecido").setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
    tecido.setDoubleSided(true);
    const scene = doc.createScene("Camiseta");
    for (const sexo of ["masculino", "feminino"] as const) {
      scene.addChild(addMesh(doc, `Camiseta_${sexo}`, generateShirt, sexo, SHIRT_MORPHS, { camiseta: tecido }));
    }
    doc.getRoot().getAsset().generator = "provador-virtual/build-models";
    const file = join(OUT, "camiseta-base.glb");
    writeFileSync(file, await io.writeBinary(doc));
    console.log(`✔ ${file}`);
  }

  // Guia de UV para quem for criar texturas no Photoshop/Figma
  {
    const S = 2048;
    const px = (m: number) => (m / UV_ATLAS_METERS) * S;
    const py = (v: number) => (1 - v / UV_ATLAS_METERS) * S;
    const lay = getShirtLayout("masculino");
    const rect = (u0: number, v0: number, u1: number, v1: number, label: string, color: string) =>
      `<rect x="${px(u0)}" y="${py(v1)}" width="${px(u1 - u0)}" height="${py(v0) - py(v1)}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="4" stroke-dasharray="18 10"/>
       <text x="${px(u0) + 24}" y="${py(v1) + 60}" font-family="sans-serif" font-size="44" font-weight="700" fill="${color}">${label}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <rect width="100%" height="100%" fill="#fafafa"/>
      ${rect(UV_LAYOUT.front.minU, lay.hemV - 0.05, UV_LAYOUT.front.maxU, 1.58, "FRENTE", "#c7a96b")}
      ${rect(UV_LAYOUT.back.minU, lay.hemV - 0.05, UV_LAYOUT.back.maxU, 1.58, "COSTAS", "#4a6fa5")}
      ${rect(0.06, 0.02, 0.58, 0.3, "MANGA ESQUERDA", "#3f8f6b")}
      ${rect(0.7, 0.02, 1.22, 0.3, "MANGA DIREITA", "#3f8f6b")}
      ${rect(UV_LAYOUT.rib.u0, UV_LAYOUT.rib.v0, 0.65, UV_LAYOUT.rib.v0 + UV_LAYOUT.rib.height, "GOLA", "#b42318")}
      <line x1="${px(lay.frontNeck.u)}" y1="${py(lay.frontNeck.v)}" x2="${px(lay.frontNeck.u)}" y2="${py(lay.hemV)}" stroke="#c7a96b" stroke-width="3"/>
      <circle cx="${px(lay.frontNeck.u)}" cy="${py(lay.frontNeck.v)}" r="14" fill="#c7a96b"/>
      <text x="${px(lay.frontNeck.u) + 24}" y="${py(lay.frontNeck.v) + 14}" font-family="sans-serif" font-size="34" fill="#17191d">centro do decote</text>
      <line x1="${px(lay.backNeck.u)}" y1="${py(lay.backNeck.v)}" x2="${px(lay.backNeck.u)}" y2="${py(lay.hemV)}" stroke="#4a6fa5" stroke-width="3"/>
      <circle cx="${px(lay.backNeck.u)}" cy="${py(lay.backNeck.v)}" r="14" fill="#4a6fa5"/>
      <text x="40" y="${S - 40}" font-family="sans-serif" font-size="34" fill="#68707d">Atlas 2048 px = 1,6 m de tecido (1 px ≈ 0,78 mm). Estampa da frente: a partir de ~7 cm abaixo do decote.</text>
    </svg>`;
    const file = join(OUT, "camiseta-uv-guia.png");
    await sharp(Buffer.from(svg)).png().toFile(file);
    console.log(`✔ ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
