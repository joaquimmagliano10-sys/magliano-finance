import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <Logo />
        <h1 className="mt-8 font-display text-5xl font-bold">404</h1>
        <p className="mt-2 text-muted">Não encontramos esta página.</p>
        <Link href="/" className="btn-primary mt-8">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
