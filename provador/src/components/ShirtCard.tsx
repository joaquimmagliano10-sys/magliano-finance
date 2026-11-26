"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import { sortSizes } from "@/lib/sizes";
import type { PublicShirt } from "@/lib/types";

export function ShirtCard({ shirt, index = 0 }: { shirt: PublicShirt; index?: number }) {
  const [colorId, setColorId] = useState(shirt.cores[0]?.id);
  const color = shirt.cores.find((c) => c.id === colorId) ?? shirt.cores[0];
  const image = color?.imagem || shirt.fotos[0];
  return (
    <article className="group card flex flex-col overflow-hidden animate-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="relative aspect-[5/6] overflow-hidden bg-[#f4f2ee]">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={`${shirt.nome} na cor ${color?.nome}`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading={index < 3 ? "eager" : "lazy"}
          />
        )}
        {shirt.modelagem === "oversized" && (
          <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold tracking-widest text-white uppercase">
            Oversized
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-tight font-bold">{shirt.nome}</h3>
          <p className="shrink-0 font-display text-lg font-bold">{formatPrice(shirt.preco)}</p>
        </div>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Cores">
          {shirt.cores.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={c.id === color?.id}
              aria-label={c.nome}
              title={c.nome}
              onClick={() => setColorId(c.id)}
              className={`h-6 w-6 rounded-full border border-black/15 transition ${c.id === color?.id ? "ring-2 ring-ink ring-offset-2" : "hover:scale-110"}`}
              style={{ background: c.hex }}
            />
          ))}
          <span className="ml-1 text-xs text-muted">{color?.nome}</span>
        </div>
        <p className="text-xs text-muted">Tamanhos: {sortSizes(shirt.tamanhos).join(" · ")}</p>
        <div className="mt-auto flex gap-2 pt-1">
          <Link href={`/provar/${shirt.slug}?cor=${color?.id ?? ""}`} className="btn-primary flex-1">
            <Sparkles className="h-4 w-4 text-gold" /> Provar
          </Link>
          {shirt.linkCompra && (
            <a href={shirt.linkCompra} target="_blank" rel="noreferrer" className="btn-outline !px-4" aria-label={`Comprar ${shirt.nome}`}>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
