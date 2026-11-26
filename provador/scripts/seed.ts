/**
 * Insere as camisas de exemplo (seed/camisas.json).
 *  - Com DATABASE_URL: cria as tabelas no Postgres e insere as camisas que ainda não existem.
 *  - Sem DATABASE_URL: recria o arquivo local .data/db.json a partir do seed.
 *
 * Observação: o app já faz isso sozinho no primeiro acesso; use este script para
 * restaurar os exemplos ou preparar o banco antes do deploy.
 * Uso: npm run seed   (ou: npm run seed -- --reset para zerar o arquivo local)
 */
import { neon } from "@neondatabase/serverless";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import seed from "../seed/camisas.json";

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const sql = neon(url);
    await sql.query(`CREATE TABLE IF NOT EXISTS camisas (id text PRIMARY KEY, slug text UNIQUE NOT NULL, dados jsonb NOT NULL, ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS provas (dia date NOT NULL, camisa_id text NOT NULL, tipo text NOT NULL, origem text NOT NULL, total integer NOT NULL DEFAULT 0, PRIMARY KEY (dia, camisa_id, tipo, origem))`);
    await sql.query(`CREATE TABLE IF NOT EXISTS meta (chave text PRIMARY KEY, valor text NOT NULL)`);
    let n = 0;
    for (const s of seed) {
      const { id, slug, ativo, ...dados } = s;
      const r = await sql.query("INSERT INTO camisas (id, slug, dados, ativo) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id", [id, slug, JSON.stringify(dados), ativo]);
      n += r.length;
    }
    await sql.query("INSERT INTO meta (chave, valor) VALUES ('seed', $1) ON CONFLICT DO NOTHING", [new Date().toISOString()]);
    console.log(`✔ Postgres pronto. ${n} camisa(s) inserida(s).`);
    return;
  }
  const file = join(process.cwd(), ".data", "db.json");
  if (existsSync(file) && !process.argv.includes("--reset")) {
    console.log("Arquivo .data/db.json já existe. Use `npm run seed -- --reset` para recriar com as camisas de exemplo.");
    return;
  }
  rmSync(file, { force: true });
  mkdirSync(join(process.cwd(), ".data"), { recursive: true });
  const now = new Date().toISOString();
  writeFileSync(file, JSON.stringify({ shirts: seed.map((s) => ({ ...s, criadoEm: now, atualizadoEm: now })), counts: {} }, null, 2));
  console.log("✔ .data/db.json recriado com as camisas de exemplo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
