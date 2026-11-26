import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes dos clientes HTTP dos provedores com fetch simulado: conferem o
 * formato das requisições, o acompanhamento do job e o tratamento de erros —
 * sem gastar créditos nem depender de rede.
 */
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let responses: Array<{ status?: number; body: unknown }> = [];

beforeEach(() => {
  calls = [];
  responses = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift() ?? { status: 500, body: { erro: "sem resposta simulada" } };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  });
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const input = { personImage: "data:image/jpeg;base64,AAA", garmentImage: "https://cdn.exemplo.com/camisa.jpg", garmentDescription: "camiseta" };

describe("FASHN", () => {
  it("envia o corpo no formato /v1/run e lê o status", async () => {
    vi.stubEnv("FASHN_API_KEY", "fa-test");
    const { fashnProvider } = await import("@/lib/tryon/fashn");
    responses.push({ body: { id: "pred_123", error: null } });
    const ref = await fashnProvider.start(input);
    expect(ref).toEqual({ id: "pred_123" });
    expect(calls[0].url).toBe("https://api.fashn.ai/v1/run");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer fa-test");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.model_name).toBe("tryon-v1.6");
    expect(body.inputs).toMatchObject({ model_image: input.personImage, garment_image: input.garmentImage, category: "tops", return_base64: true });

    responses.push({ body: { id: "pred_123", status: "processing" } });
    expect(await fashnProvider.status(ref)).toEqual({ state: "processing" });
    expect(calls[1].url).toBe("https://api.fashn.ai/v1/status/pred_123");

    responses.push({ body: { id: "pred_123", status: "completed", output: ["data:image/jpeg;base64,ZZZ"] } });
    expect(await fashnProvider.status(ref)).toEqual({ state: "completed", image: { base64: "data:image/jpeg;base64,ZZZ" } });

    responses.push({ body: { id: "pred_123", status: "failed", error: { name: "PoseError", message: "no pose" } } });
    const failed = await fashnProvider.status(ref);
    expect(failed.state).toBe("failed");
  });

  it("não aceita ids malformados (evita path traversal na URL)", async () => {
    vi.stubEnv("FASHN_API_KEY", "fa-test");
    const { fashnProvider } = await import("@/lib/tryon/fashn");
    expect((await fashnProvider.status({ id: "../../admin" })).state).toBe("failed");
    expect(calls).toHaveLength(0);
  });

  it("traduz 429 em mensagem amigável", async () => {
    vi.stubEnv("FASHN_API_KEY", "fa-test");
    const { fashnProvider } = await import("@/lib/tryon/fashn");
    responses.push({ status: 429, body: { error: "rate" } });
    await expect(fashnProvider.start(input)).rejects.toMatchObject({ userMessage: expect.stringMatching(/Muita gente/) });
  });
});

describe("fal.ai (Kling)", () => {
  it("usa a fila e só segue URLs de queue.fal.run", async () => {
    vi.stubEnv("FAL_KEY", "fal-test");
    const { falKlingProvider } = await import("@/lib/tryon/fal-kling");
    responses.push({
      body: {
        request_id: "r1",
        status_url: "https://queue.fal.run/fal-ai/kling/requests/r1/status",
        response_url: "https://queue.fal.run/fal-ai/kling/requests/r1",
      },
    });
    const ref = await falKlingProvider.start(input);
    expect(calls[0].url).toBe("https://queue.fal.run/fal-ai/kling/v1-5/kolors-virtual-try-on");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Key fal-test");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ human_image_url: input.personImage, garment_image_url: input.garmentImage });

    responses.push({ body: { status: "COMPLETED" } }, { body: { image: { url: "https://v3.fal.media/x.png" } } });
    expect(await falKlingProvider.status(ref)).toEqual({ state: "completed", image: { url: "https://v3.fal.media/x.png" } });

    const evil = await falKlingProvider.status({ id: "r1", s: "https://evil.example/steal", r: ref.r });
    expect(evil.state).toBe("failed");
  });
});

describe("Replicate (IDM-VTON)", () => {
  it("só fica disponível com token E versão; nunca é escolhido no modo auto", async () => {
    vi.stubEnv("REPLICATE_API_TOKEN", "r8_test");
    const { replicateProvider } = await import("@/lib/tryon/replicate");
    expect(replicateProvider.isConfigured()).toBe(false);
    vi.resetModules();
    vi.stubEnv("REPLICATE_MODEL_VERSION", "abc123");
    const { activeProvider } = await import("@/lib/tryon");
    expect(activeProvider()).toBeNull(); // auto ignora o provedor não comercial
  });
});
