import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Início">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link href="/#catalogo" className="hidden rounded-full px-3 py-2 hover:bg-black/5 sm:inline-flex">
            Catálogo
          </Link>
          <Link href="/#como-funciona" className="hidden rounded-full px-3 py-2 hover:bg-black/5 sm:inline-flex">
            Como funciona
          </Link>
          <Link href="/#catalogo" className="btn-primary !px-4 !py-2">
            Provar agora
          </Link>
        </nav>
      </div>
    </header>
  );
}
