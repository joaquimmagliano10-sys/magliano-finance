"use client";

import { useCallback } from "react";
import { demoTryOn } from "@/lib/client/demo-tryon";
import { loadImage } from "@/lib/client/images";
import { textureFor } from "@/lib/client/texture-spec";
import type { PublicShirt } from "@/lib/types";
import { resultKey, useProvador } from "@/store/provador";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForPose(timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = useProvador.getState();
    if (s.poseStatus !== "analisando" && s.poseStatus !== "idle") return s.pose;
    await sleep(150);
  }
  return useProvador.getState().pose;
}

/**
 * Executa uma prova em foto: envia ao servidor, acompanha o job e, se não houver
 * IA configurada (ou ela falhar), gera a prévia simulada no próprio navegador.
 */
export function useTryOnRunner(opts: { origem: "web" | "loja"; kioskToken?: string | null }) {
  const { origem, kioskToken } = opts;

  const runDemo = useCallback(async (shirt: PublicShirt, colorId: string, aviso?: string) => {
    const key = resultKey(shirt.id, colorId);
    const { photo, setResult } = useProvador.getState();
    if (!photo) return;
    setResult(key, { status: "processando", mode: "demo" });
    const pose = await waitForPose();
    if (!pose) {
      setResult(key, {
        status: "erro",
        error: aviso ?? "Não encontramos o corpo na foto para montar a prévia. Tente uma foto de frente, com o tronco visível.",
      });
      return;
    }
    try {
      const img = await loadImage(photo.url);
      const spec = textureFor(shirt, colorId)!;
      const image = await demoTryOn({ photo: img, width: photo.width, height: photo.height, landmarks: pose.landmarks, mask: pose.mask, spec });
      setResult(key, { status: "pronto", image, mode: "demo", error: aviso });
    } catch (err) {
      console.error(err);
      setResult(key, { status: "erro", error: "Não foi possível montar a prévia." });
    }
  }, []);

  const run = useCallback(
    async (shirt: PublicShirt, colorId: string) => {
      const key = resultKey(shirt.id, colorId);
      const { photo, setResult } = useProvador.getState();
      if (!photo) return;
      setResult(key, { status: "enviando", startedAt: Date.now(), image: undefined, error: undefined, mode: undefined, shareToken: undefined });
      const fd = new FormData();
      fd.append("foto", photo.blob, "foto.jpg");
      fd.append("camisaId", shirt.id);
      fd.append("corId", colorId);
      fd.append("consentimento", "sim");
      fd.append("origem", origem);
      const headers: Record<string, string> = {};
      if (kioskToken) headers["x-kiosk-token"] = kioskToken;
      let data: { modo?: string; job?: string; provedor?: string; erro?: string; podeUsarDemo?: boolean };
      try {
        const res = await fetch("/api/tryon", { method: "POST", body: fd, headers });
        data = await res.json();
        if (!res.ok) {
          if (data.podeUsarDemo) return runDemo(shirt, colorId, `${data.erro} Mostrando uma prévia simulada.`);
          setResult(key, { status: "erro", error: data.erro ?? "Falha ao enviar a foto." });
          return;
        }
      } catch {
        setResult(key, { status: "erro", error: "Sem conexão com o servidor. Verifique a internet e tente de novo." });
        return;
      }
      if (data.modo === "demo" || !data.job) return runDemo(shirt, colorId);

      setResult(key, { status: "processando", mode: "ia", provider: data.provedor });
      const deadline = Date.now() + 170_000;
      let delay = 1800;
      while (Date.now() < deadline) {
        await sleep(delay);
        delay = Math.min(3500, delay + 250);
        if (useProvador.getState().results[key]?.status !== "processando") return; // sessão reiniciada
        try {
          const r = await fetch(`/api/tryon/status?job=${encodeURIComponent(data.job)}`);
          const s = (await r.json()) as { estado?: string; imagem?: string; mensagem?: string; erro?: string };
          if (s.estado === "pronto" && s.imagem) {
            setResult(key, { status: "pronto", image: s.imagem, mode: "ia" });
            return;
          }
          if (s.estado === "erro" || !r.ok) {
            setResult(key, { status: "erro", error: s.mensagem ?? s.erro ?? "A prova não pôde ser gerada." });
            return;
          }
        } catch {
          /* falha de rede momentânea: tenta de novo */
        }
      }
      setResult(key, { status: "erro", error: "A IA demorou demais para responder. Tente novamente." });
    },
    [origem, kioskToken, runDemo],
  );

  return { run, runDemo };
}
