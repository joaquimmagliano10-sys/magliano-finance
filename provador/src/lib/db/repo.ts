import type { EventKind, EventSource, Shirt, ShirtInput, Stats } from "../types";

/**
 * Repositório do catálogo e das métricas. Duas implementações:
 *  - FileRepo: arquivo JSON local (.data/db.json) — zero configuração para rodar em casa;
 *    em ambiente sem disco gravável (Vercel sem banco) vira memória, com aviso no admin.
 *  - PostgresRepo: Postgres (Neon/Vercel Postgres) via DATABASE_URL.
 */
export interface CatalogRepo {
  readonly kind: "arquivo" | "memoria" | "postgres";
  listShirts(opts?: { includeInactive?: boolean }): Promise<Shirt[]>;
  getShirt(id: string): Promise<Shirt | null>;
  getShirtBySlug(slug: string): Promise<Shirt | null>;
  createShirt(input: ShirtInput, id?: string): Promise<Shirt>;
  updateShirt(id: string, input: ShirtInput): Promise<Shirt | null>;
  deleteShirt(id: string): Promise<boolean>;
  recordEvent(shirtId: string, kind: EventKind, source: EventSource): Promise<void>;
  stats(days?: number): Promise<Stats>;
}

/** Data (AAAA-MM-DD) no fuso de Brasília, para o "hoje" do painel bater com a loja. */
export function today(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export function lastDays(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(today(new Date(now - i * 86_400_000)));
  return out;
}

export interface CountRow {
  dia: string;
  shirtId: string;
  kind: EventKind;
  source: EventSource;
  total: number;
}

/** Monta as estatísticas do painel a partir das contagens diárias. */
export function buildStats(rows: CountRow[], shirts: Shirt[], days = 14): Stats {
  const names = new Map(shirts.map((s) => [s.id, s.nome]));
  const per = new Map<string, { foto: number; v360: number }>();
  for (const s of shirts) per.set(s.id, { foto: 0, v360: 0 });
  const range = lastDays(days);
  const daily = new Map(range.map((d) => [d, 0]));
  const t = today();
  const weekStart = range[Math.max(0, range.length - 7)];
  const totals = { hoje: 0, semana: 0, total: 0, loja: 0 };
  for (const r of rows) {
    const cur = per.get(r.shirtId) ?? { foto: 0, v360: 0 };
    if (r.kind === "foto") cur.foto += r.total;
    else cur.v360 += r.total;
    per.set(r.shirtId, cur);
    if (r.kind !== "foto") continue; // "provas" no painel = provas com foto
    totals.total += r.total;
    if (r.source === "loja") totals.loja += r.total;
    if (r.dia === t) totals.hoje += r.total;
    if (r.dia >= weekStart) totals.semana += r.total;
    if (daily.has(r.dia)) daily.set(r.dia, (daily.get(r.dia) ?? 0) + r.total);
  }
  const perShirt = [...per.entries()]
    .map(([shirtId, v]) => ({ shirtId, nome: names.get(shirtId) ?? "(camisa removida)", foto: v.foto, v360: v.v360, total: v.foto + v.v360 }))
    .sort((a, b) => b.total - a.total);
  return { perShirt, daily: [...daily.entries()].map(([dia, total]) => ({ dia, total })), totals };
}
