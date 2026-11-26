"use client";

import { ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ShirtTextureSpec } from "@/lib/client/shirt-texture";
import { slugify } from "@/lib/format";
import { SIZE_ORDER, sortSizes } from "@/lib/sizes";
import type { PrintPosition, Shirt } from "@/lib/types";
import { LazyViewer360 } from "../three/LazyViewer";
import { DeleteShirtButton } from "./DeleteShirtButton";

type ColorRow = { id: string; nome: string; hex: string; imagem: string | null };

interface FormState {
  nome: string;
  slug: string;
  descricao: string;
  preco: string;
  modelagem: "slim" | "regular" | "oversized";
  tamanhos: string[];
  cores: ColorRow[];
  fotos: string[];
  estampaFrente: string | null;
  estampaCostas: string | null;
  padrao: string | null;
  estampaLargura: number;
  estampaPosicao: PrintPosition;
  padraoEscala: number;
  linkCompra: string;
  ativo: boolean;
}

const fromShirt = (s?: Shirt): FormState => ({
  nome: s?.nome ?? "",
  slug: s?.slug ?? "",
  descricao: s?.descricao ?? "",
  preco: s ? (s.preco / 100).toFixed(2).replace(".", ",") : "",
  modelagem: s?.modelagem ?? "regular",
  tamanhos: s?.tamanhos ?? ["P", "M", "G", "GG"],
  cores: s?.cores.map((c) => ({ ...c, imagem: c.imagem ?? null })) ?? [{ id: "", nome: "Preto", hex: "#17191d", imagem: null }],
  fotos: s?.fotos ?? [],
  estampaFrente: s?.estampaFrente ?? null,
  estampaCostas: s?.estampaCostas ?? null,
  padrao: s?.padrao ?? null,
  estampaLargura: s?.estampaLargura ?? 0.26,
  estampaPosicao: s?.estampaPosicao ?? "centro",
  padraoEscala: s?.padraoEscala ?? 0.18,
  linkCompra: s?.linkCompra ?? "",
  ativo: s?.ativo ?? true,
});

async function upload(file: File, tipo: "foto" | "estampa" | "padrao"): Promise<string> {
  const fd = new FormData();
  fd.append("arquivo", file);
  fd.append("tipo", tipo);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = (await res.json()) as { url?: string; erro?: string };
  if (!res.ok || !data.url) throw new Error(data.erro ?? "Falha no envio");
  return data.url;
}

function UploadSlot({
  label,
  value,
  onChange,
  tipo,
  hint,
  aspect = "aspect-square",
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  tipo: "foto" | "estampa" | "padrao";
  hint?: string;
  aspect?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <span className="label">{label}</span>
      <div className={`relative overflow-hidden rounded-xl border border-dashed border-line bg-[repeating-conic-gradient(#f1eee8_0_25%,#fff_0_50%)] bg-[length:16px_16px] ${aspect}`}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-contain" />
            <button type="button" onClick={() => onChange(null)} className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink/80 text-white" aria-label="Remover">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => ref.current?.click()} className="grid h-full w-full place-items-center text-xs text-muted hover:text-ink">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      {err && <p className="mt-1 text-[11px] text-danger">{err}</p>}
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setErr(null);
          try {
            onChange(await upload(f, tipo));
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function ShirtForm({ shirt }: { shirt?: Shirt }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => fromShirt(shirt));
  const [previewColor, setPreviewColor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSize, setCustomSize] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const up = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const setColor = (i: number, patch: Partial<ColorRow>) => setF((s) => ({ ...s, cores: s.cores.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const pc = f.cores[Math.min(previewColor, f.cores.length - 1)];
  const texture: ShirtTextureSpec | null = pc
    ? {
        hex: /^#[0-9a-f]{6}$/i.test(pc.hex) ? pc.hex : "#cccccc",
        estampaFrente: f.estampaFrente,
        estampaCostas: f.estampaCostas,
        padrao: f.padrao,
        padraoEscala: f.padraoEscala,
        estampaLargura: f.estampaLargura,
        estampaPosicao: f.estampaPosicao,
      }
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const preco = Math.round(Number(f.preco.replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(preco)) return setError("Preço inválido.");
    setSaving(true);
    const res = await fetch(shirt ? `/api/admin/camisas/${shirt.id}` : "/api/admin/camisas", {
      method: shirt ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, preco, slug: f.slug || slugify(f.nome) }),
    });
    const data = (await res.json().catch(() => ({}))) as { erro?: string };
    setSaving(false);
    if (!res.ok) return setError(data.erro ?? "Não foi possível salvar.");
    router.push("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-display text-lg font-bold">Produto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Nome</span>
              <input className="input" required value={f.nome} onChange={(e) => up("nome", e.target.value)} placeholder="Camiseta Essencial" />
            </label>
            <label className="block">
              <span className="label">Preço (R$)</span>
              <input className="input" required inputMode="decimal" value={f.preco} onChange={(e) => up("preco", e.target.value)} placeholder="89,90" />
            </label>
            <label className="block">
              <span className="label">Modelagem</span>
              <select className="input" value={f.modelagem} onChange={(e) => up("modelagem", e.target.value as FormState["modelagem"])}>
                <option value="slim">Slim</option>
                <option value="regular">Regular</option>
                <option value="oversized">Oversized</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Descrição</span>
              <textarea className="input min-h-20" value={f.descricao} onChange={(e) => up("descricao", e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Link de compra</span>
              <input className="input" type="url" value={f.linkCompra} onChange={(e) => up("linkCompra", e.target.value)} placeholder="https://sualoja.com.br/produto" />
            </label>
            <label className="block">
              <span className="label">Endereço (slug)</span>
              <input className="input" value={f.slug} onChange={(e) => up("slug", slugify(e.target.value))} placeholder={slugify(f.nome) || "gerado-do-nome"} />
            </label>
            <label className="flex items-center gap-3 self-end pb-2.5 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-[#17191d]" checked={f.ativo} onChange={(e) => up("ativo", e.target.checked)} /> Visível no catálogo
            </label>
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-display text-lg font-bold">Tamanhos</h2>
          <div className="flex flex-wrap gap-2">
            {sortSizes([...new Set([...SIZE_ORDER.slice(0, 6), ...f.tamanhos])]).map((s) => {
              const on = f.tamanhos.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => up("tamanhos", on ? f.tamanhos.filter((x) => x !== s) : sortSizes([...f.tamanhos, s]))}
                  className={`min-w-12 rounded-xl border px-3 py-2 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
                >
                  {s}
                </button>
              );
            })}
            <span className="flex items-center gap-1">
              <input className="input !w-20 !py-2" value={customSize} onChange={(e) => setCustomSize(e.target.value.toUpperCase().slice(0, 6))} placeholder="Outro" />
              <button
                type="button"
                className="chip"
                onClick={() => {
                  if (customSize && !f.tamanhos.includes(customSize)) up("tamanhos", sortSizes([...f.tamanhos, customSize]));
                  setCustomSize("");
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          <p className="text-[11px] text-muted">A recomendação de tamanho usa a tabela em src/lib/sizes.ts — ajuste à sua grade.</p>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Cores</h2>
            <button type="button" className="chip" onClick={() => up("cores", [...f.cores, { id: "", nome: "", hex: "#ffffff", imagem: null }])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar cor
            </button>
          </div>
          {f.cores.map((c, i) => (
            <div key={i} className={`grid grid-cols-[96px_1fr] gap-4 rounded-2xl border p-3 ${i === previewColor ? "border-gold" : "border-line"}`} onFocus={() => setPreviewColor(i)} onClick={() => setPreviewColor(i)}>
              <UploadSlot label="Foto" tipo="foto" value={c.imagem} onChange={(url) => setColor(i, { imagem: url })} aspect="aspect-[5/6]" />
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Nome da cor</span>
                  <input className="input" required value={c.nome} onChange={(e) => setColor(i, { nome: e.target.value })} placeholder="Azul marinho" />
                </label>
                <div className="flex items-end gap-2">
                  <label className="block flex-1">
                    <span className="label">Cor do tecido</span>
                    <div className="flex gap-2">
                      <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#ffffff"} onChange={(e) => setColor(i, { hex: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-line" />
                      <input className="input font-mono" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} />
                    </div>
                  </label>
                  {f.cores.length > 1 && (
                    <button type="button" className="chip !text-danger" onClick={() => up("cores", f.cores.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted">
            Sem foto? Geramos automaticamente uma imagem da peça com a cor e a estampa (usada pela IA de try-on). Fotos reais “flat lay”, em fundo claro, dão
            resultados melhores.
          </p>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-display text-lg font-bold">Estampa e textura (modelo 3D)</h2>
          <div className="grid grid-cols-3 gap-4">
            <UploadSlot label="Estampa frente" tipo="estampa" value={f.estampaFrente} onChange={(v) => up("estampaFrente", v)} hint="PNG transparente" />
            <UploadSlot label="Estampa costas" tipo="estampa" value={f.estampaCostas} onChange={(v) => up("estampaCostas", v)} hint="PNG transparente" />
            <UploadSlot label="Padrão corrido" tipo="padrao" value={f.padrao} onChange={(v) => up("padrao", v)} hint="Bloco que se repete" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="label">Posição da estampa</span>
              <select className="input" value={f.estampaPosicao} onChange={(e) => up("estampaPosicao", e.target.value as PrintPosition)}>
                <option value="centro">Centro do peito</option>
                <option value="peito-esquerdo">Peito esquerdo (logo)</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Largura da estampa · {Math.round(f.estampaLargura * 100)} cm</span>
              <input type="range" min={4} max={40} value={Math.round(f.estampaLargura * 100)} onChange={(e) => up("estampaLargura", Number(e.target.value) / 100)} className="w-full accent-[#c7a96b]" />
            </label>
            <label className="block">
              <span className="label">Repetição do padrão · {Math.round(f.padraoEscala * 100)} cm</span>
              <input type="range" min={4} max={50} value={Math.round(f.padraoEscala * 100)} onChange={(e) => up("padraoEscala", Number(e.target.value) / 100)} className="w-full accent-[#c7a96b]" />
            </label>
          </div>
          <p className="text-[11px] text-muted">
            Um único modelo 3D de camiseta serve para todo o catálogo: a cor, a estampa e o padrão viram a textura. Guia do molde:{" "}
            <a href="/models/camiseta-uv-guia.png" target="_blank" className="underline">
              camiseta-uv-guia.png
            </a>
            .
          </p>
        </section>

        <section className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Galeria de fotos</h2>
            <button type="button" className="chip" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" /> Enviar fotos
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {f.fotos.map((u, i) => (
              <div key={u} className="relative aspect-[5/6] overflow-hidden rounded-xl bg-[#f4f2ee]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => up("fotos", f.fotos.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink/80 text-white" aria-label="Remover foto">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {!f.fotos.length && <p className="text-sm text-muted">Sem fotos: o catálogo usa a imagem da primeira cor.</p>}
          <input
            ref={galleryRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              for (const file of files) {
                try {
                  const url = await upload(file, "foto");
                  setF((s) => ({ ...s, fotos: [...s.fotos, url] }));
                } catch (x) {
                  setError((x as Error).message);
                }
              }
            }}
          />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Prévia 3D</p>
            <div className="flex gap-1.5">
              {f.cores.map((c, i) => (
                <button type="button" key={i} onClick={() => setPreviewColor(i)} className={`h-6 w-6 rounded-full border border-black/15 ${i === previewColor ? "ring-2 ring-gold ring-offset-1" : ""}`} style={{ background: c.hex }} aria-label={c.nome} />
              ))}
            </div>
          </div>
          <LazyViewer360 className="h-[420px] bg-gradient-to-b from-white to-[#ece8df]" sexo="masculino" measurements={null} shirtChest={null} texture={texture} autoRotate />
        </div>
        {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <button disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-gold" />} {shirt ? "Salvar alterações" : "Cadastrar camisa"}
          </button>
          <Link href="/admin" className="btn-outline">
            Cancelar
          </Link>
        </div>
        {shirt && (
          <div className="flex justify-end">
            <DeleteShirtButton id={shirt.id} nome={shirt.nome} redirectTo="/admin" />
          </div>
        )}
      </aside>
    </form>
  );
}
