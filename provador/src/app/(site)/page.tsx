import { Camera, Lock, Rotate3d, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";
import { HeroShowcase } from "@/components/HeroShowcase";
import { ShirtCard } from "@/components/ShirtCard";
import { BRAND } from "@/lib/brand";
import { repo } from "@/lib/db";
import { toPublicShirt } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const shirts = (await repo().listShirts()).map(toPublicShirt);
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="grain absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-4 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up py-2 sm:py-6 lg:py-16">
            <p className="eyebrow">Provador virtual · {BRAND.nome}</p>
            <h1 className="mt-4 font-display text-[2.75rem] leading-[0.95] font-bold tracking-tight sm:text-6xl lg:text-7xl">
              {BRAND.slogan.split(" ").slice(0, -1).join(" ")} <span className="text-gold-2">{BRAND.slogan.split(" ").slice(-1)}</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted sm:mt-5 sm:text-lg">
              Tire uma foto, escolha a camisa e veja como ela fica em você. Depois gire o avatar em 360° para ver frente, costas e laterais.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
              <Link href="#catalogo" className="btn-primary sm:!px-6 sm:!py-3.5 sm:text-base">
                <Sparkles className="h-4 w-4 text-gold" /> Escolher camisa
              </Link>
              <Link href="#como-funciona" className="btn-outline sm:!px-6 sm:!py-3.5 sm:text-base">
                Como funciona
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted sm:mt-6">
              <Lock className="h-3.5 w-3.5" /> Sua foto não fica salva. Tudo é apagado em até 24 h.
            </p>
          </div>
          <HeroShowcase shirts={shirts} />
        </div>
      </section>

      <section id="catalogo" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Escolha e prove</h2>
          </div>
          <p className="hidden max-w-xs text-right text-sm text-muted sm:block">
            Toque nas cores para ver cada variação. O provador funciona no celular, no computador e no tablet da loja.
          </p>
        </div>
        {shirts.length === 0 ? (
          <p className="card mt-8 p-10 text-center text-muted">Nenhuma camisa cadastrada ainda.</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shirts.map((s, i) => (
              <ShirtCard key={s.id} shirt={s} index={i} />
            ))}
          </div>
        )}
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <p className="eyebrow">Como funciona</p>
        <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Três passos, menos de um minuto</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: Shirt, t: "Escolha a camisa", d: "Selecione o modelo, a cor e o tamanho que você quer provar." },
            { icon: Camera, t: "Tire ou envie uma foto", d: "De frente, com boa luz e os braços um pouco afastados do corpo." },
            { icon: Rotate3d, t: "Veja e gire em 360°", d: "A IA aplica a camisa na sua foto e um avatar com suas proporções mostra todos os ângulos." },
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
          <strong>Transparência:</strong> a prova em foto é gerada por inteligência artificial e pode ter pequenas diferenças da peça real. O 360°
          usa um avatar 3D ajustado às proporções estimadas da sua foto — é uma aproximação, não uma réplica exata do seu corpo.
        </div>
      </section>
    </>
  );
}
