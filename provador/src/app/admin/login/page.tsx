import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/Logo";
import { adminConfigWarning } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const warning = adminConfigWarning();
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="card mt-8 p-6">
          <h1 className="font-display text-2xl font-bold">Painel da loja</h1>
          <p className="mt-1 text-sm text-muted">Cadastre camisas e acompanhe as provas.</p>
          {warning && <p className="mt-4 rounded-xl bg-warn/10 p-3 text-xs text-warn">{warning}</p>}
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
