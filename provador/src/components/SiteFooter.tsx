import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">{BRAND.descricao}</p>
        </div>
        <div className="text-sm">
          <p className="eyebrow !text-gold">Privacidade</p>
          <ul className="mt-3 space-y-2">
            <li>Sua foto não fica salva.</li>
            <li>Processamento apagado em até 24 h.</li>
            <li>
              <Link href="/privacidade" className="underline decoration-gold underline-offset-4 hover:text-white">
                Política de privacidade (LGPD)
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="eyebrow !text-gold">Loja</p>
          <ul className="mt-3 space-y-2">
            <li>{BRAND.cidade}</li>
            {BRAND.instagram && (
              <li>
                <a href={BRAND.instagram} className="hover:text-white" target="_blank" rel="noreferrer">
                  Instagram
                </a>
              </li>
            )}
            <li>
              <Link href="/loja" className="hover:text-white">
                Modo provador da loja
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
        © {new Date().getFullYear()} {BRAND.nome}. A visualização 360° é uma aproximação feita com um avatar 3D.
      </div>
    </footer>
  );
}
