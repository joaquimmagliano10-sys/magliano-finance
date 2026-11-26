"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const fd = new FormData(e.currentTarget);
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: fd.get("email"), senha: fd.get("senha") }),
        });
        setLoading(false);
        if (!res.ok) {
          setError(((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "Falha ao entrar.");
          return;
        }
        const back = params.get("voltar");
        router.replace(back && back.startsWith("/admin") ? back : "/admin");
        router.refresh();
      }}
    >
      <label className="block">
        <span className="label">E-mail</span>
        <input name="email" type="email" required autoComplete="username" className="input" />
      </label>
      <label className="block">
        <span className="label">Senha</span>
        <input name="senha" type="password" required autoComplete="current-password" className="input" />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={loading} className="btn-primary w-full">
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
