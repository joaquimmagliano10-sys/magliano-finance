import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import type { EventKind, EventSource, Shirt, ShirtInput, Stats } from "../types";
import { buildStats, type CatalogRepo, type CountRow, today } from "./repo";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS camisas (
     id text PRIMARY KEY,
     slug text UNIQUE NOT NULL,
     dados jsonb NOT NULL,
     ativo boolean NOT NULL DEFAULT true,
     criado_em timestamptz NOT NULL DEFAULT now(),
     atualizado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS provas (
     dia date NOT NULL,
     camisa_id text NOT NULL,
     tipo text NOT NULL,
     origem text NOT NULL,
     total integer NOT NULL DEFAULT 0,
     PRIMARY KEY (dia, camisa_id, tipo, origem)
   )`,
  `CREATE TABLE IF NOT EXISTS meta (chave text PRIMARY KEY, valor text NOT NULL)`,
];

type Row = { id: string; slug: string; dados: Omit<Shirt, "id" | "slug" | "ativo" | "criadoEm" | "atualizadoEm">; ativo: boolean; criado_em: string | Date; atualizado_em: string | Date };

const toShirt = (r: Row): Shirt => ({
  ...r.dados,
  id: r.id,
  slug: r.slug,
  ativo: r.ativo,
  criadoEm: new Date(r.criado_em).toISOString(),
  atualizadoEm: new Date(r.atualizado_em).toISOString(),
});

const split = (input: ShirtInput) => {
  const { slug, ativo, ...dados } = input;
  return { slug, ativo, dados };
};

export class PostgresRepo implements CatalogRepo {
  readonly kind = "postgres" as const;
  private sql: NeonQueryFunction<false, false>;
  private ready: Promise<void> | null = null;

  constructor(
    url: string,
    private seed: () => Promise<Array<ShirtInput & { id?: string }>>,
  ) {
    this.sql = neon(url);
  }

  /** Cria as tabelas e, só na primeira vez, insere as camisas de exemplo. */
  private init() {
    this.ready ??= (async () => {
      for (const stmt of SCHEMA) await this.sql.query(stmt);
      const seeded = await this.sql.query("SELECT valor FROM meta WHERE chave = 'seed'");
      if (seeded.length === 0) {
        for (const s of await this.seed()) {
          const { slug, ativo, dados } = split(s);
          await this.sql.query("INSERT INTO camisas (id, slug, dados, ativo) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING", [
            s.id ?? randomUUID(),
            slug,
            JSON.stringify(dados),
            ativo,
          ]);
        }
        await this.sql.query("INSERT INTO meta (chave, valor) VALUES ('seed', $1) ON CONFLICT DO NOTHING", [new Date().toISOString()]);
      }
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  async listShirts(opts?: { includeInactive?: boolean }) {
    await this.init();
    const rows = (await this.sql.query(
      opts?.includeInactive ? "SELECT * FROM camisas ORDER BY criado_em" : "SELECT * FROM camisas WHERE ativo ORDER BY criado_em",
    )) as Row[];
    return rows.map(toShirt);
  }
  async getShirt(id: string) {
    await this.init();
    const rows = (await this.sql.query("SELECT * FROM camisas WHERE id = $1", [id])) as Row[];
    return rows[0] ? toShirt(rows[0]) : null;
  }
  async getShirtBySlug(slug: string) {
    await this.init();
    const rows = (await this.sql.query("SELECT * FROM camisas WHERE slug = $1", [slug])) as Row[];
    return rows[0] ? toShirt(rows[0]) : null;
  }
  async createShirt(input: ShirtInput, id?: string) {
    await this.init();
    const { slug, ativo, dados } = split(input);
    try {
      const rows = (await this.sql.query("INSERT INTO camisas (id, slug, dados, ativo) VALUES ($1, $2, $3, $4) RETURNING *", [
        id ?? randomUUID(),
        slug,
        JSON.stringify(dados),
        ativo,
      ])) as Row[];
      return toShirt(rows[0]);
    } catch (err) {
      if (String(err).includes("duplicate")) throw new Error("Já existe uma camisa com esse endereço (slug).");
      throw err;
    }
  }
  async updateShirt(id: string, input: ShirtInput) {
    await this.init();
    const { slug, ativo, dados } = split(input);
    try {
      const rows = (await this.sql.query(
        "UPDATE camisas SET slug = $2, dados = $3, ativo = $4, atualizado_em = now() WHERE id = $1 RETURNING *",
        [id, slug, JSON.stringify(dados), ativo],
      )) as Row[];
      return rows[0] ? toShirt(rows[0]) : null;
    } catch (err) {
      if (String(err).includes("duplicate")) throw new Error("Já existe uma camisa com esse endereço (slug).");
      throw err;
    }
  }
  async deleteShirt(id: string) {
    await this.init();
    const rows = await this.sql.query("DELETE FROM camisas WHERE id = $1 RETURNING id", [id]);
    return rows.length > 0;
  }
  async recordEvent(shirtId: string, kind: EventKind, source: EventSource) {
    await this.init();
    await this.sql.query(
      `INSERT INTO provas (dia, camisa_id, tipo, origem, total) VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (dia, camisa_id, tipo, origem) DO UPDATE SET total = provas.total + 1`,
      [today(), shirtId, kind, source],
    );
  }
  async stats(days = 14): Promise<Stats> {
    await this.init();
    const raw = (await this.sql.query(
      "SELECT to_char(dia, 'YYYY-MM-DD') AS dia, camisa_id, tipo, origem, total FROM provas",
    )) as Array<{ dia: string; camisa_id: string; tipo: EventKind; origem: EventSource; total: number }>;
    const rows: CountRow[] = raw.map((r) => ({ dia: r.dia, shirtId: r.camisa_id, kind: r.tipo, source: r.origem, total: Number(r.total) }));
    return buildStats(rows, await this.listShirts({ includeInactive: true }), days);
  }
}
