import { CheckCircle2, CircleAlert, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { DeleteShirtButton } from "@/components/admin/DeleteShirtButton";
import { DailyBars, ShirtBars } from "@/components/admin/Charts";
import { adminConfigWarning } from "@/lib/auth";
import { config } from "@/lib/config";
import { repo } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { activeProvider } from "@/lib/tryon";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = repo();
  const [stats, shirts] = await Promise.all([db.stats(14), db.listShirts({ includeInactive: true })]);
  const provider = activeProvider();
  const custoSemana = provider ? stats.totals.semana * provider.approxCostUsd : 0;
  const health: Array<{ ok: boolean; label: string; detail: string }> = [
    {
      ok: !!provider,
      label: "Prova com IA",
      detail: provider ? `${provider.label} (~US$ ${provider.approxCostUsd.toFixed(3)}/prova)` : "Modo demonstração — defina FASHN_API_KEY ou FAL_KEY",
    },
    {
      ok: db.kind !== "memoria",
      label: "Banco de dados",
      detail: db.kind === "postgres" ? "Postgres" : db.kind === "arquivo" ? "Arquivo local (.data/db.json)" : "Memória — os dados se perdem! Defina DATABASE_URL",
    },
    { ok: !!config.blobToken || !config.onVercel, label: "Arquivos", detail: config.blobToken ? "Vercel Blob" : "Pasta local .data/ (só para uso local)" },
    { ok: !!config.upstash.url || !config.onVercel, label: "Rate limit", detail: config.upstash.url ? "Upstash Redis" : "Memória do servidor" },
    { ok: !!config.kioskToken, label: "Modo loja", detail: config.kioskToken ? "Token do quiosque configurado" : "Sem KIOSK_TOKEN — o tablet usa o limite comum" },
    {
      ok: !!config.admin.passwordHash,
      label: "Senha do painel",
      detail: config.admin.passwordHash ? "Hash bcrypt configurado" : (adminConfigWarning() ?? "Senha de desenvolvimento — defina ADMIN_PASSWORD_HASH antes de publicar"),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Provas no provador</h1>
        </div>
        <Link href="/admin/camisas/nova" className="btn-primary">
          <Plus className="h-4 w-4 text-gold" /> Nova camisa
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Hoje", v: stats.totals.hoje },
          { l: "Últimos 7 dias", v: stats.totals.semana },
          { l: "Total", v: stats.totals.total },
          { l: "No tablet da loja", v: stats.totals.loja },
        ].map(({ l, v }) => (
          <div key={l} className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{l}</p>
            <p className="mt-2 font-display text-4xl font-bold tabular-nums">{v}</p>
            <p className="mt-1 text-xs text-muted">provas com foto</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">Provas com foto por dia</h2>
          <p className="text-xs text-muted">Últimos 14 dias</p>
          <div className="mt-4">
            <DailyBars data={stats.daily} />
          </div>
          {provider && (
            <p className="mt-3 text-xs text-muted">
              Custo estimado da IA nos últimos 7 dias: <strong className="text-ink">US$ {custoSemana.toFixed(2)}</strong>
            </p>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">Configuração</h2>
          <ul className="mt-4 space-y-3">
            {health.map((h) => (
              <li key={h.label} className="flex items-start gap-3 text-sm">
                {h.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />}
                <span>
                  <strong>{h.label}</strong>
                  <span className="block text-xs text-muted">{h.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">Quantas vezes cada camisa foi provada</h2>
        <p className="mb-4 text-xs text-muted">Contagem anônima — nenhuma foto ou dado do cliente é guardado.</p>
        <ShirtBars rows={stats.perShirt} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Camisas ({shirts.length})</h2>
        <div className="card divide-y divide-line">
          {shirts.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.cores[0]?.imagem || s.fotos[0] || "/logo.svg"} alt="" className="h-16 w-14 rounded-lg bg-[#f4f2ee] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {s.nome} {!s.ativo && <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-muted uppercase">inativa</span>}
                </p>
                <p className="text-xs text-muted">
                  {formatPrice(s.preco)} · {s.cores.length} {s.cores.length === 1 ? "cor" : "cores"} · {s.tamanhos.join(" ")}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/camisas/${s.id}`} className="chip">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Link>
                <DeleteShirtButton id={s.id} nome={s.nome} />
              </div>
            </div>
          ))}
          {!shirts.length && <p className="p-6 text-center text-sm text-muted">Nenhuma camisa ainda.</p>}
        </div>
      </section>
    </div>
  );
}
