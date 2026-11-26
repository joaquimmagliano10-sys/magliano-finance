import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildStats, today } from "@/lib/db/repo";
import { ImageError, normalizePhoto, sniffImage } from "@/lib/image";
import { _resetMemoryLimiter, limit } from "@/lib/ratelimit";
import { shirtInputSchema } from "@/lib/shirt-schema";
import { evaluateFit, recommendSize, shirtChest } from "@/lib/sizes";
import { signToken, verifyToken } from "@/lib/tokens";
import type { Shirt } from "@/lib/types";

describe("tokens assinados", () => {
  const secret = "x".repeat(40);
  it("aceita token íntegro e rejeita adulterado, expirado ou com outro segredo", () => {
    const t = signToken({ p: "fashn", r: { id: "abc" } }, secret, 60);
    expect(verifyToken<{ p: string }>(t, secret)?.p).toBe("fashn");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ p: "fal", r: { s: "https://evil" }, exp: 9e9 })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, secret)).toBeNull();
    expect(verifyToken(`${body}.${sig}x`, secret)).toBeNull();
    expect(verifyToken(t, "y".repeat(40))).toBeNull();
    expect(verifyToken(signToken({ a: 1 }, secret, -1), secret)).toBeNull();
  });
});

describe("imagens enviadas", () => {
  it("detecta o tipo real pelo cabeçalho", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("remove metadados (EXIF/GPS) e reduz o tamanho", async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c7a96b" } })
      .withMetadata({ exif: { IFD0: { Copyright: "secreto", Make: "Camera" } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(big).metadata()).exif).toBeDefined();
    const out = await normalizePhoto(big, { maxBytes: 20e6, maxSide: 1280 });
    const meta = await sharp(out.data).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1280);
    expect(meta.exif).toBeUndefined();
  });

  it("rejeita arquivo grande, pequeno ou de tipo errado", async () => {
    await expect(normalizePhoto(Buffer.alloc(100), { maxBytes: 10 })).rejects.toBeInstanceOf(ImageError);
    await expect(normalizePhoto(Buffer.from("GIF89a................"), { maxBytes: 1e6 })).rejects.toThrow(/Formato/);
    const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).jpeg().toBuffer();
    await expect(normalizePhoto(tiny, { maxBytes: 1e6 })).rejects.toThrow(/pequena/);
  });
});

describe("rate limit (memória)", () => {
  it("bloqueia após o limite e informa quando liberar", async () => {
    _resetMemoryLimiter();
    const rule = { max: 3, windowSec: 60 };
    for (let i = 0; i < 3; i++) expect((await limit("teste", rule)).ok).toBe(true);
    const r = await limit("teste", rule);
    expect(r.ok).toBe(false);
    expect(r.resetSec).toBeGreaterThan(0);
    expect((await limit("outro-ip", rule)).ok).toBe(true);
  });
});

describe("tamanhos", () => {
  it("recomenda o menor tamanho com folga ideal", () => {
    expect(recommendSize("masculino", 0.98, ["P", "M", "G", "GG"])).toBe("M");
    expect(recommendSize("masculino", 1.08, ["P", "M", "G", "GG"])).toBe("GG");
    expect(recommendSize("masculino", 0.9, ["P", "M", "G"])).toBe("P");
  });
  it("classifica o caimento", () => {
    expect(evaluateFit(0.98, shirtChest("masculino", "M")!).level).toBe("ideal");
    expect(evaluateFit(1.1, shirtChest("masculino", "P")!).level).toBe("apertada");
    expect(evaluateFit(0.9, shirtChest("masculino", "XGG")!).level).toBe("grande");
    expect(evaluateFit(0.98, shirtChest("masculino", "G", "oversized")!, "oversized").level).toBe("ideal");
  });
});

describe("validação do cadastro", () => {
  it("normaliza slug, ids de cor e tamanhos", () => {
    const r = shirtInputSchema.parse({
      nome: "Camiseta Ação Total",
      preco: 9990,
      tamanhos: ["m", "g"],
      cores: [{ nome: "Azul Marinho", hex: "#1f2a44" }],
    });
    expect(r.slug).toBe("camiseta-acao-total");
    expect(r.cores[0].id).toBe("azul-marinho");
    expect(r.tamanhos).toEqual(["M", "G"]);
  });
  it("rejeita URLs de imagem perigosas e cores inválidas", () => {
    const base = { nome: "X1", preco: 100, tamanhos: ["M"], cores: [{ nome: "A", hex: "#000000" }] };
    expect(shirtInputSchema.safeParse({ ...base, estampaFrente: "javascript:alert(1)" }).success).toBe(false);
    expect(shirtInputSchema.safeParse({ ...base, cores: [{ nome: "A", hex: "red" }] }).success).toBe(false);
    expect(shirtInputSchema.safeParse({ ...base, linkCompra: "nao-e-url" }).success).toBe(false);
  });
});

describe("métricas", () => {
  it("agrega provas por camisa e por dia", () => {
    const shirt = { id: "a", nome: "A" } as Shirt;
    const s = buildStats(
      [
        { dia: today(), shirtId: "a", kind: "foto", source: "web", total: 3 },
        { dia: today(), shirtId: "a", kind: "foto", source: "loja", total: 2 },
        { dia: today(), shirtId: "a", kind: "360", source: "web", total: 7 },
        { dia: "2000-01-01", shirtId: "a", kind: "foto", source: "web", total: 1 },
      ],
      [shirt],
    );
    expect(s.totals).toEqual({ hoje: 5, semana: 5, total: 6, loja: 2 });
    expect(s.perShirt[0]).toMatchObject({ foto: 6, v360: 7 });
    expect(s.daily).toHaveLength(14);
    expect(s.daily[13].total).toBe(5);
  });
});
