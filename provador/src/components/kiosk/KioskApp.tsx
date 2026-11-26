"use client";

import { ArrowLeft, Camera, Expand, Hand, QrCode, RefreshCw, Repeat, ShieldCheck, Sparkles } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIdleReset } from "@/hooks/useIdleReset";
import { usePoseEstimate } from "@/hooks/usePoseEstimate";
import { useTryOnRunner } from "@/hooks/useTryOnRunner";
import type { Sexo } from "@/lib/body/types";
import { BRAND } from "@/lib/brand";
import { dataUrlToBlob, preparePhoto } from "@/lib/client/images";
import { formatPrice } from "@/lib/format";
import { recommendSize, sortSizes } from "@/lib/sizes";
import type { PublicShirt } from "@/lib/types";
import { resultKey, useProvador } from "@/store/provador";
import { Logo } from "../Logo";
import { CameraCapture } from "../tryon/CameraCapture";
import { ConsentBox } from "../tryon/ConsentBox";
import { Panel360 } from "../tryon/Panel360";
import { PhotoResultPanel } from "../tryon/PhotoResultPanel";
import { PhotoTips } from "../tryon/PhotoGuide";
import { PosePreview } from "../tryon/PosePreview";
import { ShirtPickerSheet } from "../tryon/ShirtPickerSheet";

type Stage = "atracao" | "catalogo" | "camera" | "confirmar" | "resultado";

const TOKEN_KEY = "provador-quiosque-token";

/**
 * Modo loja (tablet/TV): tela cheia, botões grandes, câmera sempre ativa e QR
 * code para o cliente levar a imagem no próprio celular. Após 60 s sem toque a
 * sessão é reiniciada e TODOS os dados do cliente anterior são apagados da tela
 * e da memória.
 */
export function KioskApp({ shirts }: { shirts: PublicShirt[] }) {
  const st = useProvador();
  const [stage, setStage] = useState<Stage>("atracao");
  const [picker, setPicker] = useState(false);
  const [kioskToken, setKioskToken] = useState<string | null>(null);
  const [qr, setQr] = useState<{ key: string; url: string; img: string; expiresAt: number } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [shot, setShot] = useState(0);
  const qrRequested = useRef<string | null>(null);
  usePoseEstimate();
  const { run, runDemo } = useTryOnRunner({ origem: "loja", kioskToken });

  // Token do quiosque (?chave=...) — configuração do aparelho, não dado de cliente
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("chave");
    try {
      if (fromUrl) {
        localStorage.setItem(TOKEN_KEY, fromUrl);
        url.searchParams.delete("chave");
        window.history.replaceState(null, "", url.toString());
      }
      setKioskToken(fromUrl ?? localStorage.getItem(TOKEN_KEY));
    } catch {
      setKioskToken(fromUrl);
    }
  }, []);

  const shirt = useMemo(() => shirts.find((s) => s.id === st.shirtId) ?? shirts[0], [shirts, st.shirtId]);
  const color = shirt?.cores.find((c) => c.id === st.colorId) ?? shirt?.cores[0];
  const key = shirt && color ? resultKey(shirt.id, color.id) : "";
  const result = st.results[key];
  const busy = result?.status === "enviando" || result?.status === "processando";

  const resetAll = useCallback(() => {
    useProvador.getState().reset();
    setQr(null);
    setQrError(null);
    qrRequested.current = null;
    setPicker(false);
    setStage("atracao");
    window.scrollTo(0, 0);
  }, []);

  const { remaining, poke } = useIdleReset({ enabled: stage !== "atracao", paused: busy, onReset: resetAll });

  const goFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const chooseShirt = (s: PublicShirt, colorId?: string) => {
    const sizes = sortSizes(s.tamanhos);
    st.set({ shirtId: s.id, colorId: colorId ?? s.cores[0]?.id ?? null, size: sizes.includes("M") ? "M" : sizes[0] });
  };

  const onPhoto = async (blob: Blob) => {
    const p = await preparePhoto(blob);
    const prev = useProvador.getState().photo;
    if (prev) URL.revokeObjectURL(prev.url);
    st.set({ photo: { url: URL.createObjectURL(p.blob), blob: p.blob, width: p.width, height: p.height }, results: {}, measurementsSource: "padrao", consent: false });
    setStage("confirmar");
  };

  const startTryOn = () => {
    if (!shirt || !color || !st.consent) return;
    setStage("resultado");
    void run(shirt, color.id);
  };

  // Sugestão de tamanho após a estimativa
  useEffect(() => {
    if (!shirt || !st.measurements || st.measurementsSource === "padrao") return;
    const rec = recommendSize(st.sexo, st.measurements.peito, shirt.tamanhos, shirt.modelagem);
    if (rec && stage === "confirmar") st.set({ size: rec });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.measurements, st.measurementsSource, shirt?.id]);

  // QR code: quando a prova fica pronta, cria o link temporário
  useEffect(() => {
    if (stage !== "resultado" || result?.status !== "pronto" || !result.image || !shirt) return;
    if (qrRequested.current === key) return;
    qrRequested.current = key;
    setQr(null);
    setQrError(null);
    (async () => {
      try {
        const fd = new FormData();
        fd.append("imagem", await dataUrlToBlob(result.image!), "prova.jpg");
        fd.append("camisaId", shirt.id);
        fd.append("consentimento", "sim");
        const headers: Record<string, string> = {};
        if (kioskToken) headers["x-kiosk-token"] = kioskToken;
        const res = await fetch("/api/resultados", { method: "POST", body: fd, headers });
        const data = (await res.json()) as { url?: string; expiraEm?: number; erro?: string };
        if (!res.ok || !data.url) throw new Error(data.erro ?? "Falha ao gerar o link");
        const full = new URL(data.url, window.location.origin).toString();
        const img = await QRCode.toDataURL(full, { margin: 1, width: 420, color: { dark: "#17191d", light: "#ffffff" } });
        if (qrRequested.current === key) setQr({ key, url: full, img, expiresAt: data.expiraEm ?? Date.now() });
      } catch (err) {
        if (qrRequested.current === key) setQrError((err as Error).message);
      }
    })();
  }, [stage, result?.status, result?.image, key, shirt, kioskToken]);

  if (!shirt) {
    return <div className="grid min-h-dvh place-items-center bg-ink text-white">Cadastre camisas no painel para usar o modo loja.</div>;
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-white select-none" onPointerDown={poke}>
      {/* Barra superior */}
      {stage !== "atracao" && (
        <header className="relative z-20 flex items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <Logo light />
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/70 md:flex">
              <ShieldCheck className="h-4 w-4 text-gold" /> Seus dados são apagados ao sair
            </span>
            <button onClick={resetAll} className="btn !bg-white/10 !text-white hover:!bg-white/20">
              <RefreshCw className="h-4 w-4" /> Recomeçar
            </button>
          </div>
        </header>
      )}

      {stage === "atracao" && (
        <button
          className="absolute inset-0 block h-full w-full text-left"
          onClick={() => {
            goFullscreen();
            setStage("catalogo");
          }}
          aria-label="Toque para começar"
        >
          <div className="absolute inset-0 opacity-60">
            <CameraCapture onCapture={() => undefined} hideControls showGuide={false} defaultTimer={0} className="h-full w-full !rounded-none" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/20" />
          <div className="absolute inset-0 flex flex-col justify-between p-10 lg:p-16">
            <Logo light />
            <div>
              <p className="eyebrow !text-gold">Provador virtual</p>
              <h1 className="mt-4 max-w-4xl font-display text-6xl leading-[0.92] font-bold lg:text-8xl">
                Prove sem trocar de roupa.
              </h1>
              <p className="mt-6 max-w-2xl text-xl text-white/75 lg:text-2xl">
                Escolha a camisa, tire uma foto e veja em você — depois gire em 360° e leve a imagem no seu celular.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-6">
                <span className="inline-flex animate-pulse-ring items-center gap-3 rounded-full bg-gold px-10 py-6 text-2xl font-bold text-ink">
                  <Hand className="h-7 w-7" /> Toque para começar
                </span>
                <div className="flex -space-x-4">
                  {shirts.slice(0, 4).map((s) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={s.id} src={s.cores[0]?.imagem || s.fotos[0]} alt="" className="h-20 w-20 rounded-full border-4 border-ink object-cover" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </button>
      )}

      {stage === "catalogo" && (
        <main className="relative z-10 px-6 pb-10 lg:px-10">
          <h1 className="font-display text-4xl font-bold lg:text-5xl">1. Escolha a camisa</h1>
          <div className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-3">
            {shirts.map((s) => {
              const active = s.id === shirt.id;
              const c = active ? color : s.cores[0];
              return (
                <div key={s.id} className={`overflow-hidden rounded-3xl border-2 transition ${active ? "border-gold bg-white/10" : "border-white/10 bg-white/5"}`}>
                  <button onClick={() => chooseShirt(s)} className="block w-full text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c?.imagem || s.fotos[0]} alt={s.nome} className="aspect-[5/5] w-full bg-[#f4f2ee] object-cover" />
                    <div className="flex items-start justify-between gap-3 p-5">
                      <p className="font-display text-2xl leading-tight font-bold">{s.nome}</p>
                      <p className="shrink-0 font-display text-2xl font-bold text-gold">{formatPrice(s.preco)}</p>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-3 px-5 pb-5">
                    {s.cores.map((cc) => (
                      <button
                        key={cc.id}
                        onClick={() => chooseShirt(s, cc.id)}
                        className={`h-12 w-12 rounded-full border-2 border-white/30 ${active && cc.id === color?.id ? "ring-4 ring-gold ring-offset-2 ring-offset-ink" : ""}`}
                        style={{ background: cc.hex }}
                        aria-label={cc.nome}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sticky bottom-6 mt-8 flex justify-center">
            <button onClick={() => setStage("camera")} className="btn-gold !px-12 !py-6 text-2xl shadow-[var(--shadow-lift)]">
              <Camera className="h-7 w-7" /> Tirar foto com a {shirt.nome.replace(/^Camiseta /, "")}
            </button>
          </div>
        </main>
      )}

      {stage === "camera" && (
        <main className="relative z-10 grid gap-6 px-6 pb-8 lg:grid-cols-[1fr_380px] lg:px-10">
          <CameraCapture onCapture={onPhoto} large defaultTimer={3} triggerKey={shot} className="h-[calc(100dvh-8rem)] w-full" />
          <aside className="flex flex-col gap-6 rounded-3xl bg-white/5 p-8">
            <button onClick={() => setStage("catalogo")} className="inline-flex items-center gap-2 text-lg text-white/70">
              <ArrowLeft className="h-5 w-5" /> Voltar
            </button>
            <h1 className="font-display text-4xl font-bold">2. Posicione-se</h1>
            <div className="text-lg">
              <PhotoTips dark />
            </div>
            <p className="text-white/60">Afaste-se até o corpo caber no contorno. Toque no botão dourado — a foto sai em 3 segundos.</p>
            <button onClick={() => setShot((v) => v + 1)} className="btn-gold mt-auto !py-6 text-2xl">
              <Camera className="h-7 w-7" /> Tirar foto
            </button>
          </aside>
        </main>
      )}

      {stage === "confirmar" && st.photo && (
        <main className="relative z-10 grid gap-8 px-6 pb-8 lg:grid-cols-[1fr_1fr] lg:px-10">
          <PosePreview photo={st.photo} className="h-[calc(100dvh-8rem)] w-full" />
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-4xl font-bold">3. Confirme</h1>
            <div>
              <p className="mb-3 text-sm font-semibold tracking-widest text-white/60 uppercase">Modelo do avatar 3D</p>
              <div className="grid grid-cols-2 gap-3">
                {(["masculino", "feminino"] as Sexo[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => st.set({ sexo: s })}
                    className={`rounded-2xl border-2 py-5 text-xl font-bold capitalize ${st.sexo === s ? "border-gold bg-gold text-ink" : "border-white/20"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-ink">
              <ConsentBox checked={st.consent} onChange={(v) => st.set({ consent: v })} large kiosk />
            </div>
            <div className="mt-auto grid grid-cols-[auto_1fr] gap-4">
              <button onClick={() => setStage("camera")} className="btn !bg-white/10 !px-8 !py-6 text-xl !text-white">
                <Camera className="h-6 w-6" /> Outra foto
              </button>
              <button onClick={startTryOn} disabled={!st.consent} className="btn-gold !py-6 text-2xl">
                <Sparkles className="h-7 w-7" /> Provar agora
              </button>
            </div>
          </div>
        </main>
      )}

      {stage === "resultado" && st.photo && (
        <main className="relative z-10 grid gap-6 px-6 pb-8 lg:grid-cols-[1fr_1fr_340px] lg:px-10">
          <PhotoResultPanel shirt={shirt} onGenerate={() => color && run(shirt, color.id)} onDemo={() => color && runDemo(shirt, color.id)} className="h-[calc(100dvh-9rem)]" />
          <Panel360 shirt={shirt} dark viewerClassName="h-[calc(100dvh-24rem)] min-h-[340px]" />
          <aside className="flex flex-col gap-5">
            <div className="rounded-3xl bg-white/5 p-6">
              <p className="font-display text-2xl leading-tight font-bold">{shirt.nome}</p>
              <p className="mt-1 font-display text-2xl font-bold text-gold">{formatPrice(shirt.preco)}</p>
              <p className="mt-1 text-white/60">
                {color?.nome} · tamanho {st.size}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-6 text-center text-ink">
              {qr ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr.img} alt="QR code para baixar a imagem" className="mx-auto aspect-square w-full max-w-[240px]" />
                  <p className="mt-3 flex items-center justify-center gap-2 font-display text-lg font-bold">
                    <QrCode className="h-5 w-5" /> Leve no seu celular
                  </p>
                  <p className="mt-1 text-sm text-muted">Aponte a câmera do celular. O link expira em {Math.max(1, Math.round((qr.expiresAt - Date.now()) / 60000))} min.</p>
                </>
              ) : qrError ? (
                <p className="py-8 text-sm text-danger">{qrError}</p>
              ) : (
                <div className="grid aspect-square place-items-center text-sm text-muted">
                  <span className="flex flex-col items-center gap-3">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-gold" />
                    {busy ? "O QR code aparece quando a prova ficar pronta" : "Gerando QR code…"}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-auto grid gap-3">
              <button onClick={() => setPicker(true)} className="btn !bg-white/10 !py-5 text-xl !text-white">
                <Repeat className="h-6 w-6" /> Trocar camisa
              </button>
              <button onClick={resetAll} className="btn-gold !py-5 text-xl">
                <RefreshCw className="h-6 w-6" /> Nova prova
              </button>
            </div>
          </aside>
        </main>
      )}

      <ShirtPickerSheet
        open={picker}
        dark
        shirts={shirts}
        currentId={shirt.id}
        onClose={() => setPicker(false)}
        onPick={(s) => {
          setPicker(false);
          chooseShirt(s);
          if (st.measurements && st.measurementsSource !== "padrao") {
            const rec = recommendSize(st.sexo, st.measurements.peito, s.tamanhos, s.modelagem);
            if (rec) st.set({ size: rec });
          }
          void fetch("/api/eventos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ camisaId: s.id, origem: "loja" }) }).catch(() => undefined);
        }}
      />

      {/* Aviso de inatividade */}
      {remaining !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur" onPointerDown={poke}>
          <div className="rounded-3xl bg-white p-10 text-center text-ink">
            <p className="font-display text-4xl font-bold">Ainda está aí?</p>
            <p className="mt-3 text-lg text-muted">Por privacidade, vamos recomeçar e apagar seus dados em</p>
            <p className="mt-4 font-display text-8xl font-bold tabular-nums text-gold-2">{remaining}</p>
            <button onClick={poke} className="btn-primary mt-6 !px-10 !py-5 text-xl">
              Continuar
            </button>
          </div>
        </div>
      )}

      {stage !== "atracao" && (
        <button onClick={goFullscreen} className="fixed right-5 bottom-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/70" aria-label="Tela cheia">
          <Expand className="h-5 w-5" />
        </button>
      )}
      <span className="sr-only">{BRAND.nome}</span>
    </div>
  );
}
