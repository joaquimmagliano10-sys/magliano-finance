import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { EventKind, EventSource, Shirt, ShirtInput, Stats } from "../types";
import { buildStats, type CatalogRepo, type CountRow, today } from "./repo";

interface DbFile {
  shirts: Shirt[];
  /** chave: dia|camisa|tipo|origem */
  counts: Record<string, number>;
}

export class FileRepo implements CatalogRepo {
  readonly kind: "arquivo" | "memoria";
  private data: DbFile | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private path: string | null,
    private seed: () => Promise<Array<ShirtInput & { id?: string }>>,
  ) {
    this.kind = path ? "arquivo" : "memoria";
  }

  private async load(): Promise<DbFile> {
    if (this.data) return this.data;
    if (this.path) {
      try {
        this.data = JSON.parse(await readFile(this.path, "utf8")) as DbFile;
        return this.data;
      } catch {
        /* primeiro uso: cria a partir do seed */
      }
    }
    const now = new Date().toISOString();
    const seed = await this.seed();
    this.data = {
      shirts: seed.map((s) => ({ ...s, id: s.id ?? randomUUID(), criadoEm: now, atualizadoEm: now })),
      counts: {},
    };
    await this.persist();
    return this.data;
  }

  private async persist() {
    if (!this.path || !this.data) return;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      await writeFile(tmp, JSON.stringify(this.data, null, 2));
      await rename(tmp, this.path);
    } catch (err) {
      console.warn("[db] não foi possível gravar o arquivo; seguindo em memória.", (err as Error).message);
      this.path = null;
    }
  }

  /** Serializa escritas para não corromper o arquivo. */
  private write<T>(fn: (d: DbFile) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const d = await this.load();
      const out = fn(d);
      await this.persist();
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listShirts(opts?: { includeInactive?: boolean }) {
    const d = await this.load();
    return d.shirts.filter((s) => opts?.includeInactive || s.ativo).map((s) => ({ ...s }));
  }
  async getShirt(id: string) {
    return (await this.load()).shirts.find((s) => s.id === id) ?? null;
  }
  async getShirtBySlug(slug: string) {
    return (await this.load()).shirts.find((s) => s.slug === slug) ?? null;
  }
  createShirt(input: ShirtInput, id?: string) {
    return this.write((d) => {
      if (d.shirts.some((s) => s.slug === input.slug)) throw new Error("Já existe uma camisa com esse endereço (slug).");
      const now = new Date().toISOString();
      const shirt: Shirt = { ...input, id: id ?? randomUUID(), criadoEm: now, atualizadoEm: now };
      d.shirts.push(shirt);
      return shirt;
    });
  }
  updateShirt(id: string, input: ShirtInput) {
    return this.write((d) => {
      const i = d.shirts.findIndex((s) => s.id === id);
      if (i === -1) return null;
      if (d.shirts.some((s) => s.slug === input.slug && s.id !== id)) throw new Error("Já existe uma camisa com esse endereço (slug).");
      d.shirts[i] = { ...d.shirts[i], ...input, id, atualizadoEm: new Date().toISOString() };
      return d.shirts[i];
    });
  }
  deleteShirt(id: string) {
    return this.write((d) => {
      const before = d.shirts.length;
      d.shirts = d.shirts.filter((s) => s.id !== id);
      return d.shirts.length < before;
    });
  }
  async recordEvent(shirtId: string, kind: EventKind, source: EventSource) {
    await this.write((d) => {
      const k = `${today()}|${shirtId}|${kind}|${source}`;
      d.counts[k] = (d.counts[k] ?? 0) + 1;
    });
  }
  async stats(days = 14): Promise<Stats> {
    const d = await this.load();
    const rows: CountRow[] = Object.entries(d.counts).map(([k, total]) => {
      const [dia, shirtId, kind, source] = k.split("|");
      return { dia, shirtId, kind: kind as EventKind, source: source as EventSource, total };
    });
    return buildStats(rows, d.shirts, days);
  }
}
