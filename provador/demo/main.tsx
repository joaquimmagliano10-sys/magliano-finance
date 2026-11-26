/**
 * Versão de demonstração estática do provador (sem servidor).
 * Gerada por `npm run demo:build` em demo-dist/. Reaproveita os componentes do
 * app; a prova em foto é sempre a prévia simulada no navegador e não há painel
 * administrativo, IA nem QR code (que dependem do servidor).
 */
import { Camera, Info, Lock, Rotate3d, Shirt, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import seed from "../seed/camisas.json";
import PrivacidadePage from "../src/app/(site)/privacidade/page";
import { HeroShowcase } from "../src/components/HeroShowcase";
import { ShirtCard } from "../src/components/ShirtCard";
import { SiteFooter } from "../src/components/SiteFooter";
import { SiteHeader } from "../src/components/SiteHeader";
import { TryOnFlow } from "../src/components/tryon/TryOnFlow";
import { BRAND } from "../src/lib/brand";
import type { PublicShirt, Shirt as ShirtT } from "../src/lib/types";

const rel = (u: string | null | undefined) => (u ? u.replace(/^\//, "") : u ?? null);

const shirts: PublicShirt[] = (seed as unknown as ShirtT[]).map((s) => ({
  id: s.id,
  slug: s.slug,
  nome: s.nome,
  descricao: s.descricao,
  preco: s.preco,
  modelagem: s.modelagem,
  tamanhos: s.tamanhos,
  cores: s.cores.map((c) => ({ ...c, imagem: rel(c.imagem) })),
  fotos: s.fotos.map((f) => rel(f) as string),
  estampaFrente: rel(s.estampaFrente),
  estampaCostas: rel(s.estampaCostas),
  padrao: rel(s.padrao),
  estampaLargura: s.estampaLargura,
  estampaPosicao: s.estampaPosicao,
  padraoEscala: s.padraoEscala,
  linkCompra: s.linkCompra,
}));

function DemoBanner() {
  return (
    <div className="border-b border-gold/40 bg-gold-soft/60">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2.5 text-xs leading-relaxed text-ink/80 sm:items-center">
        <Info className="mt-px h-4 w-4 shrink-0 text-gold-2 sm:mt-0" />
        <span>
          <strong>Versão de demonstração.</strong> A prova em foto é uma prévia simulada feita no seu navegador (sem IA) e a foto vem da galeria. A versão
          publicada na Vercel acrescenta IA, câmera, modo loja com QR code e painel administrativo.
        </span>
      </p>
    </div>
  );
}

function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="grain absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-4 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up py-2 sm:py-6 lg:py-16">
            <p className="eyebrow">Provador virtual · {BRAND.nome}</p>
            <h1 className="mt-4 font-display text-[2.75rem] leading-[0.95] font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Prove antes de <span className="text-gold-2">comprar.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted sm:mt-5 sm:text-lg">
              Envie uma foto, escolha a camisa e veja como ela fica em você. Depois gire o avatar em 360° para ver frente, costas e laterais.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
              <a href="#catalogo" className="btn-primary sm:!px-6 sm:!py-3.5 sm:text-base">
                <Sparkles className="h-4 w-4 text-gold" /> Escolher camisa
              </a>
              <a href="#como-funciona" className="btn-outline sm:!px-6 sm:!py-3.5 sm:text-base">
                Como funciona
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted sm:mt-6">
              <Lock className="h-3.5 w-3.5" /> Nesta demonstração a foto nunca sai do seu aparelho.
            </p>
          </div>
          <HeroShowcase shirts={shirts} />
        </div>
      </section>

      <section id="catalogo" className="mx-auto max-w-6xl scroll-mt-6 px-4 pt-16">
        <p className="eyebrow">Catálogo</p>
        <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Escolha e prove</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shirts.map((s, i) => (
            <ShirtCard key={s.id} shirt={s} index={i} />
          ))}
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-6 px-4 pt-24">
        <p className="eyebrow">Como funciona</p>
        <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Três passos, menos de um minuto</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: Shirt, t: "Escolha a camisa", d: "Selecione o modelo, a cor e o tamanho que você quer provar." },
            { icon: Camera, t: "Envie uma foto", d: "De frente, com boa luz e os braços um pouco afastados do corpo." },
            { icon: Rotate3d, t: "Veja e gire em 360°", d: "A camisa aparece na sua foto e um avatar com suas proporções mostra todos os ângulos." },
          ].map(({ icon: Icon, t, d }, i) => (
            <div key={t} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-sm font-bold text-muted">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-[var(--radius-xl2)] border border-gold/40 bg-gold-soft/50 p-5 text-sm leading-relaxed text-ink/80">
          <strong>Transparência:</strong> o 360° usa um avatar 3D ajustado às proporções estimadas da sua foto. É uma aproximação, não uma réplica exata
          do seu corpo.
        </div>
      </section>
    </>
  );
}

function LojaInfo() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold">Modo loja</h1>
      <p className="mt-3 text-muted">
        O modo para tablet ou TV usa a câmera e gera um QR code para o cliente baixar a imagem no celular. Ele precisa do servidor e funciona na versão
        publicada na Vercel.
      </p>
      <a href="#catalogo" className="btn-primary mt-8">
        Ver catálogo
      </a>
    </div>
  );
}

function parse(hash: string) {
  const h = hash.replace(/^#/, "");
  const m = /^provar-([a-z0-9-]+?)(?:--([a-z0-9-]+))?$/.exec(h);
  if (m) return { view: "provar" as const, slug: m[1], cor: m[2] };
  if (h === "privacidade") return { view: "privacidade" as const };
  if (h === "loja") return { view: "loja" as const };
  return { view: "home" as const, section: h === "catalogo" || h === "como-funciona" ? h : null };
}

function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const route = useMemo(() => parse(hash), [hash]);
  useEffect(() => {
    if (route.view === "home" && route.section) {
      requestAnimationFrame(() => document.getElementById(route.section!)?.scrollIntoView({ behavior: "smooth" }));
    } else {
      window.scrollTo(0, 0);
    }
  }, [route]);

  const shirt = route.view === "provar" ? shirts.find((s) => s.slug === route.slug) : undefined;
  return (
    <>
      <SiteHeader />
      <DemoBanner />
      <main>
        {route.view === "provar" && shirt ? (
          <TryOnFlow key={shirt.id + (route.cor ?? "")} shirts={shirts} initialShirtId={shirt.id} initialColorId={route.cor} />
        ) : route.view === "privacidade" ? (
          <PrivacidadePage />
        ) : route.view === "loja" ? (
          <LojaInfo />
        ) : (
          <Home />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
