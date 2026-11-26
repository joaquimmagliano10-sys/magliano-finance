import { describe, expect, it } from "vitest";
import { defaultBodyForSize, heightScale, morphWeights } from "@/lib/body/morphs";
import { buildProfile, generateBody, generateShirt, getShirtLayout, sectionPerimeter } from "@/lib/body/parametric";
import { BASE_BODY, BASE_FOLGA, BODY_MORPHS, SHIRT_MORPHS } from "@/lib/body/types";

describe("gerador paramétrico", () => {
  it("seções-chave têm exatamente a circunferência pedida", () => {
    const p = buildProfile(BASE_BODY.masculino);
    expect(sectionPerimeter(p.section(p.y.chest))).toBeCloseTo(0.98, 2);
    expect(sectionPerimeter(p.section(p.y.waist))).toBeCloseTo(0.84, 2);
    expect(sectionPerimeter(p.section(p.y.hip))).toBeCloseTo(0.98, 2);
  });

  it("mantém a mesma topologia para qualquer medida (requisito dos morph targets)", () => {
    for (const sexo of ["masculino", "feminino"] as const) {
      const a = generateBody(BASE_BODY[sexo]);
      const b = generateBody({ ...BASE_BODY[sexo], peito: 1.3, cintura: 1.2, ombros: 0.52 });
      for (const k of Object.keys(a.primitives)) {
        expect(b.primitives[k].positions.length).toBe(a.primitives[k].positions.length);
        expect(b.primitives[k].indices).toEqual(a.primitives[k].indices);
      }
      const s1 = generateShirt(BASE_BODY[sexo], BASE_FOLGA[sexo]);
      const s2 = generateShirt({ ...BASE_BODY[sexo], quadril: 1.2 }, 0.3);
      expect(s2.primitives.camiseta.positions.length).toBe(s1.primitives.camiseta.positions.length);
    }
  });

  it("gera malhas válidas (sem NaN, normais unitárias, UV no atlas)", () => {
    const shirt = generateShirt(BASE_BODY.feminino, BASE_FOLGA.feminino).primitives.camiseta;
    for (const v of shirt.positions) expect(Number.isFinite(v)).toBe(true);
    for (let i = 0; i < shirt.normals.length; i += 3) {
      const l = Math.hypot(shirt.normals[i], shirt.normals[i + 1], shirt.normals[i + 2]);
      expect(l).toBeGreaterThan(0.99);
      expect(l).toBeLessThan(1.01);
    }
    for (const v of shirt.uvs) expect(v).toBeGreaterThanOrEqual(-0.001), expect(v).toBeLessThanOrEqual(1.001);
    const max = Math.max(...shirt.indices);
    expect(max).toBeLessThan(shirt.positions.length / 3);
  });

  it("decote da frente fica abaixo do das costas no atlas", () => {
    const l = getShirtLayout("masculino");
    expect(l.frontNeck.v).toBeLessThan(l.backNeck.v);
    expect(l.hemV).toBeLessThan(l.frontNeck.v - 0.4);
  });
});

describe("morphs", () => {
  it("corpo base → todas as influências zero", () => {
    const w = morphWeights(BASE_BODY.masculino, BASE_FOLGA.masculino);
    for (const d of SHIRT_MORPHS) expect(w[d.name]).toBe(0);
  });

  it("pessoa mais alta com as mesmas proporções não muda os morphs", () => {
    const s = 1.9 / 1.75;
    const m = { ...BASE_BODY.masculino, altura: 1.9, ombros: 0.46 * s, peito: 0.98 * s, cintura: 0.84 * s, quadril: 0.98 * s };
    expect(heightScale(m)).toBeCloseTo(s, 5);
    const w = morphWeights(m);
    for (const d of BODY_MORPHS) expect(w[d.name]).toBeCloseTo(0, 5);
  });

  it("usa o alvo 'mais' para medidas maiores e 'menos' para menores", () => {
    const w = morphWeights({ ...BASE_BODY.masculino, cintura: 1.04, peito: 0.91 });
    expect(w.cintura_mais).toBeCloseTo(0.5, 5);
    expect(w.cintura_menos).toBe(0);
    expect(w.peito_menos).toBeCloseTo(0.5, 5);
    expect(w.peito_mais).toBe(0);
  });

  it("avatar padrão cresce com o tamanho", () => {
    const p = defaultBodyForSize("masculino", "P").peito;
    const g = defaultBodyForSize("masculino", "GG").peito;
    expect(g).toBeGreaterThan(p);
  });
});
