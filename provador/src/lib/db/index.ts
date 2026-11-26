import "server-only";
import { join } from "node:path";
import { config } from "../config";
import type { ShirtInput } from "../types";
import seedShirts from "../../../seed/camisas.json";
import { FileRepo } from "./file-repo";
import { PostgresRepo } from "./postgres-repo";
import type { CatalogRepo } from "./repo";

const seed = async () => seedShirts as unknown as Array<ShirtInput & { id?: string }>;

const g = globalThis as unknown as { __catalogRepo?: CatalogRepo };

/**
 * Escolhe o armazenamento:
 *  - DATABASE_URL definido → Postgres;
 *  - local → arquivo .data/db.json;
 *  - Vercel sem banco → memória (funciona para demonstração, mas não persiste).
 */
export function repo(): CatalogRepo {
  if (g.__catalogRepo) return g.__catalogRepo;
  let r: CatalogRepo;
  if (config.databaseUrl) r = new PostgresRepo(config.databaseUrl, seed);
  else if (config.onVercel) r = new FileRepo(null, seed);
  else r = new FileRepo(join(process.cwd(), ".data", "db.json"), seed);
  g.__catalogRepo = r;
  return r;
}
