"use client";

import { ArrowLeft, ArrowUpRight, Camera, Check, Download, ImageUp, Lock, MessageCircle, Repeat, Rotate3d, ScanFace, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePoseEstimate } from "@/hooks/usePoseEstimate";
import { useShareActions } from "@/hooks/useShareActions";
import { useTryOnRunner } from "@/hooks/useTryOnRunner";
import type { Sexo } from "@/lib/body/types";
import { preparePhoto } from "@/lib/client/images";
import { STATIC_DEMO } from "@/lib/client/runtime";
import { formatPrice } from "@/lib/format";
import { recommendSize, sortSizes } from "@/lib/sizes";
import type { PublicShirt } from "@/lib/types";
import { resultKey, useProvador } from "@/store/provador";
import type { ViewerHandle } from "../three/Viewer360";
import { CameraCapture } from "./CameraCapture";
import { ConsentBox } from "./ConsentBox";
import { Panel360 } from "./Panel360";
import { PhotoResultPanel } from "./PhotoResultPanel";
import { PhotoTips } from "./PhotoGuide";
import { PosePreview } from "./PosePreview";
import { ShirtPickerSheet } from "./ShirtPickerSheet";

type Step = "foto" | "resultado";

export function TryOnFlow({ shirts, initialShirtId, initialColorId }: { shirts: PublicShirt[]; initialShirtId: string; initialColorId?: string }) {
  const st = useProvador();
  const [step, setStep] = useState<Step>("foto");
  const [camera, setCamera] = useState(false);
  const [picker, setPicker] = useState(false);
  const [tab, setTab] = useState<"foto" | "360">("foto");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panel360 = useRef<ViewerHandle>(null);
  usePoseEstimate();
  const { run, runDemo } = useTryOnRunner({ origem: "web" });

  // Estado inicial (camisa/cor vindas do catálogo). Sai da página → apaga tudo.
  useEffect(() => {
    const s = shirts.find((x) => x.id === initialShirtId) ?? shirts[0];
    useProvador.getState().reset();
    useProvador.getState().set({ shirtId: s?.id ?? null, colorId: s?.cores.find((c) => c.id === initialColorId)?.id ?? s?.cores[0]?.id ?? null });
    return () => useProvador.getState().reset();
  }, [shirts, initialShirtId, initialColorId]);

  const shirt = useMemo(() => shirts.find((s) => s.id === st.shirtId) ?? shirts.find((s) => s.id === initialShirtId) ?? shirts[0], [shirts, st.shirtId, initialShirtId]);
  const color = shirt.cores.find((c) => c.id === st.colorId) ?? shirt.cores[0];
  const share = useShareActions(shirt, () => panel360.current?.snapshot() ?? null);

  // Sugere o tamanho assim que houver medidas estimadas
  useEffect(() => {
    if (!st.measurements || st.size) return;
    const rec = st.measurementsSource !== "padrao" ? recommendSize(st.sexo, st.measurements.peito, shirt.tamanhos, shirt.modelagem) : null;
    const sizes = sortSizes(shirt.tamanhos);
    st.set({ size: rec ?? (sizes.includes("M") ? "M" : sizes[0]) });
  }, [st, shirt]);

  const onPhoto = useCallback(async (file: Blob) => {
    setUploadError(null);
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && file.type !== "") {
      setUploadError("Formato não suportado. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError("Foto muito grande (máximo 15 MB).");
      return;
    }
    try {
      const p = await preparePhoto(file);
      const prev = useProvador.getState().photo;
      if (prev) URL.revokeObjectURL(prev.url);
      useProvador.getState().set({
        photo: { url: URL.createObjectURL(p.blob), blob: p.blob, width: p.width, height: p.height },
        results: {},
        measurementsSource: "padrao",
      });
      setCamera(false);
    } catch {
      setUploadError("Não conseguimos abrir esta imagem. Tente outra foto.");
    }
  }, []);

  const start = () => {
    if (!st.photo || !st.consent || !color) return;
    setStep("resultado");
    setTab("foto");
    window.scrollTo({ top: 0, behavior: "smooth" });
    void run(shirt, color.id);
  };

  const pickShirt = (s: PublicShirt) => {
    setPicker(false);
    const sizes = sortSizes(s.tamanhos);
    const keep = st.size && sizes.includes(st.size) ? st.size : null;
    const rec = st.measurements && st.measurementsSource !== "padrao" ? recommendSize(st.sexo, st.measurements.peito, s.tamanhos, s.modelagem) : null;
    st.set({ shirtId: s.id, colorId: s.cores[0]?.id ?? null, size: keep ?? rec ?? (sizes.includes("M") ? "M" : sizes[0]) });
    if (s.id !== shirt.id && !STATIC_DEMO) {
      void fetch("/api/eventos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ camisaId: s.id, origem: "web" }) }).catch(() => undefined);
    }
  };

  const currentResult = st.results[resultKey(shirt.id, color?.id ?? "")];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-32">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/#catalogo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Catálogo
        </Link>
        <ol className="flex items-center gap-2 text-xs font-semibold">
          {[
            { k: "foto", l: "1 · Sua foto" },
            { k: "resultado", l: "2 · Prova e 360°" },
          ].map(({ k, l }) => (
            <li key={k} className={`rounded-full px-3 py-1.5 ${step === k ? "bg-ink text-white" : "bg-white text-muted"}`}>
              {l}
            </li>
          ))}
        </ol>
      </div>

      {step === "foto" && (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Produto escolhido */}
          <aside className="card h-fit overflow-hidden lg:sticky lg:top-24">
            <div className="flex gap-4 p-4 lg:block lg:p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={color?.imagem || shirt.fotos[0]} alt={shirt.nome} className="h-28 w-24 shrink-0 rounded-xl object-cover lg:h-auto lg:w-full lg:rounded-none" />
              <div className="lg:p-5">
                <p className="eyebrow">Você vai provar</p>
                <h1 className="mt-1 font-display text-2xl leading-tight font-bold">{shirt.nome}</h1>
                <p className="mt-1 font-display text-lg font-bold">{formatPrice(shirt.preco)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {shirt.cores.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => st.set({ colorId: c.id })}
                      className={`h-8 w-8 rounded-full border border-black/15 ${c.id === color?.id ? "ring-2 ring-ink ring-offset-2" : ""}`}
                      style={{ background: c.hex }}
                      aria-label={c.nome}
                      title={c.nome}
                    />
                  ))}
                </div>
                <p className="mt-3 hidden text-sm leading-relaxed text-muted lg:block">{shirt.descricao}</p>
                <button onClick={() => setPicker(true)} className="chip mt-4">
                  <Repeat className="h-3.5 w-3.5" /> Escolher outra camisa
                </button>
              </div>
            </div>
          </aside>

          {/* Foto */}
          <section className="space-y-5">
            {!st.photo && !camera && (
              <div className="card overflow-hidden">
                <div className="grid gap-6 p-6 sm:grid-cols-[1fr_200px] sm:p-8">
                  <div>
                    <h2 className="font-display text-2xl font-bold">Tire ou envie uma foto</h2>
                    <p className="mt-2 text-sm text-muted">Para um resultado mais realista:</p>
                    <div className="mt-4">
                      <PhotoTips />
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      {!STATIC_DEMO && (
                        <button onClick={() => setCamera(true)} className="btn-primary">
                          <Camera className="h-4 w-4 text-gold" /> Usar a câmera
                        </button>
                      )}
                      <button onClick={() => fileRef.current?.click()} className={STATIC_DEMO ? "btn-primary" : "btn-outline"}>
                        <ImageUp className="h-4 w-4" /> Enviar da galeria
                      </button>
                    </div>
                    {uploadError && <p className="mt-3 text-sm text-danger">{uploadError}</p>}
                  </div>
                  <div className="relative hidden overflow-hidden rounded-2xl bg-ink sm:block">
                    <svg viewBox="0 0 300 400" className="h-full w-full">
                      <rect width="300" height="400" fill="#23262c" />
                      <g fill="none" stroke="#c7a96b" strokeWidth="3" strokeDasharray="8 6">
                        <ellipse cx="150" cy="70" rx="30" ry="38" />
                        <path d="M126 104 Q150 118 174 104 L178 120 Q218 124 230 144 L256 262 M122 120 Q82 124 70 144 L44 262" />
                        <path d="M98 144 L102 262 Q104 296 108 338 L110 400 M202 144 L198 262 Q196 296 192 338 L190 400" />
                      </g>
                      <text x="150" y="385" textAnchor="middle" fill="#ffffff" fontSize="14" fontFamily="Inter, sans-serif" opacity="0.7">
                        braços levemente abertos
                      </text>
                    </svg>
                  </div>
                </div>
                <p className="flex items-center gap-2 border-t border-line bg-paper/60 px-6 py-3 text-xs text-muted sm:px-8">
                  <Lock className="h-3.5 w-3.5" /> A análise do corpo acontece no seu aparelho. A foto não fica salva.
                </p>
              </div>
            )}

            {camera && !st.photo && (
              <CameraCapture onCapture={onPhoto} onCancel={() => setCamera(false)} className="aspect-[3/4] max-h-[75dvh] w-full sm:aspect-[4/3]" />
            )}

            {st.photo && (
              <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
                <div>
                  <PosePreview photo={st.photo} className="aspect-[3/4] w-full" />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <PoseStatus />
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(st.photo!.url);
                        st.set({ photo: null, pose: null, estimate: null, poseStatus: "idle", measurementsSource: "padrao" });
                      }}
                      className="chip"
                    >
                      <Camera className="h-3.5 w-3.5" /> Trocar foto
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="card p-4">
                    <p className="label">Modelo do avatar 3D</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["masculino", "feminino"] as Sexo[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => st.set({ sexo: s, size: null, measurementsSource: st.measurementsSource === "manual" ? "padrao" : st.measurementsSource })}
                          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition ${st.sexo === s ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <label className="mt-4 block">
                      <span className="label">Sua altura (opcional)</span>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={120}
                          max={230}
                          placeholder="ex.: 175"
                          value={st.alturaCm ?? ""}
                          onChange={(e) => st.set({ alturaCm: e.target.value ? Number(e.target.value) : null })}
                          className="input pr-10"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted">cm</span>
                      </div>
                      <span className="mt-1.5 block text-[11px] text-muted">Melhora a estimativa das medidas e a sugestão de tamanho.</span>
                    </label>
                  </div>
                  <ConsentBox checked={st.consent} onChange={(v) => st.set({ consent: v })} />
                  <button onClick={start} disabled={!st.consent} className="btn-primary w-full !py-4 text-base">
                    <Sparkles className="h-5 w-5 text-gold" /> Provar agora
                  </button>
                  {!st.consent && <p className="text-center text-xs text-muted">Marque a autorização acima para continuar.</p>}
                </div>
              </div>
            )}
          </section>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onPhoto(f);
            }}
          />
        </div>
      )}

      {step === "resultado" && st.photo && (
        <>
          <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
            <div>
              <p className="eyebrow">Sua prova</p>
              <h1 className="mt-1 font-display text-2xl leading-tight font-bold sm:text-3xl">{shirt.nome}</h1>
              <p className="mt-1 text-sm text-muted">
                {color?.nome} · {st.size ?? "—"} · {formatPrice(shirt.preco)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("foto")} className="btn-ghost shrink-0 !px-3 text-sm whitespace-nowrap">
                <Camera className="h-4 w-4" /> Nova foto
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-[var(--shadow-soft)] lg:hidden">
            {(["foto", "360"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full py-2.5 text-sm font-semibold ${tab === t ? "bg-ink text-white" : "text-muted"}`}>
                {t === "foto" ? "Prova na foto" : "Ver em 360°"}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={tab === "foto" ? "" : "hidden lg:block"}>
              <PhotoResultPanel shirt={shirt} onGenerate={() => color && run(shirt, color.id)} onDemo={() => color && runDemo(shirt, color.id)} />
            </div>
            <div className={tab === "360" ? "" : "hidden lg:block"}>
              <Panel360 ref={panel360} shirt={shirt} />
            </div>
          </div>

          {currentResult?.status === "pronto" && tab === "foto" && (
            <button onClick={() => setTab("360")} className="btn-outline mt-4 w-full lg:hidden">
              <Rotate3d className="h-4 w-4" /> Girar em 360°
            </button>
          )}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 backdrop-blur-md">
            <div className="mx-auto grid max-w-6xl grid-cols-4 gap-2 px-3 py-3 sm:flex sm:justify-end">
              <button onClick={() => setPicker(true)} className="btn-outline flex-col !gap-1 !px-2 !py-2 text-[11px] sm:flex-row sm:!px-5 sm:!py-3 sm:text-sm">
                <Repeat className="h-4 w-4" /> Trocar camisa
              </button>
              <button disabled={share.busy} onClick={share.download} className="btn-outline flex-col !gap-1 !px-2 !py-2 text-[11px] sm:flex-row sm:!px-5 sm:!py-3 sm:text-sm">
                <Download className="h-4 w-4" /> Baixar imagem
              </button>
              <button disabled={share.busy} onClick={share.shareWhatsApp} className="btn-outline flex-col !gap-1 !px-2 !py-2 text-[11px] sm:flex-row sm:!px-5 sm:!py-3 sm:text-sm">
                <MessageCircle className="h-4 w-4 text-[#25d366]" /> WhatsApp
              </button>
              {shirt.linkCompra ? (
                <a href={shirt.linkCompra} target="_blank" rel="noreferrer" className="btn-primary flex-col !gap-1 !px-2 !py-2 text-[11px] sm:flex-row sm:!px-6 sm:!py-3 sm:text-sm">
                  <ArrowUpRight className="h-4 w-4 text-gold" /> Comprar
                </a>
              ) : (
                <span />
              )}
            </div>
          </div>
        </>
      )}

      <ShirtPickerSheet open={picker} shirts={shirts} currentId={shirt.id} onPick={pickShirt} onClose={() => setPicker(false)} />
    </div>
  );
}

function PoseStatus() {
  const status = useProvador((s) => s.poseStatus);
  const est = useProvador((s) => s.estimate);
  if (status === "analisando") return <span className="text-xs text-muted">Analisando a foto no seu aparelho…</span>;
  if (status === "ok" && est?.ok)
    return (
      <span className="flex items-start gap-1.5 text-xs text-ok">
        <Check className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Corpo detectado.{" "}
          {est.warnings[0] ? <span className="text-warn">{est.warnings[0]}</span> : est.fullBody ? "Corpo inteiro na foto — ótimo!" : "Medidas estimadas."}
        </span>
      </span>
    );
  if (status === "falhou" || (status === "ok" && est && !est.ok))
    return (
      <span className="flex items-start gap-1.5 text-xs text-warn">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        {est?.reason ?? "Não detectamos o corpo. O 360° usará o avatar padrão do tamanho escolhido."}
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <ScanFace className="h-3.5 w-3.5" /> Preparando…
    </span>
  );
}
