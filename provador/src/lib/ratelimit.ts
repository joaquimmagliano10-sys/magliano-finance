import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHmac } from "node:crypto";
import { appSecret, config } from "./config";

/**
 * Rate limit (controle de custo da API de try-on).
 * Com UPSTASH_REDIS_REST_URL usa Redis (funciona entre instâncias na Vercel);
 * sem ele, usa memória do processo (bom para desenvolvimento e quiosque único).
 * O IP nunca é guardado em claro: usamos um HMAC dele como chave.
 */
export interface Rule {
  max: number;
  windowSec: number;
}
export interface LimitResult {
  ok: boolean;
  remaining: number;
  resetSec: number;
}

const memory = new Map<string, number[]>();
function memoryLimit(key: string, rule: Rule): LimitResult {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= rule.max) {
    memory.set(key, hits);
    return { ok: false, remaining: 0, resetSec: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  memory.set(key, hits);
  if (memory.size > 10_000) {
    for (const [k, v] of memory) if (!v.length || now - v[v.length - 1] > windowMs) memory.delete(k);
  }
  return { ok: true, remaining: rule.max - hits.length, resetSec: rule.windowSec };
}

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();
function upstashLimiter(rule: Rule): Ratelimit | null {
  if (!config.upstash.url || !config.upstash.token) return null;
  redis ??= new Redis({ url: config.upstash.url, token: config.upstash.token });
  const id = `${rule.max}/${rule.windowSec}`;
  let l = limiters.get(id);
  if (!l) {
    l = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(rule.max, `${rule.windowSec} s`), prefix: "provador" });
    limiters.set(id, l);
  }
  return l;
}

export async function limit(key: string, rule: Rule): Promise<LimitResult> {
  const l = upstashLimiter(rule);
  if (!l) return memoryLimit(key, rule);
  try {
    const r = await l.limit(key);
    return { ok: r.success, remaining: r.remaining, resetSec: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
  } catch (err) {
    console.error("[ratelimit] Redis indisponível, usando memória:", (err as Error).message);
    return memoryLimit(key, rule);
  }
}

export function clientKey(req: Request): string {
  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "local";
  return createHmac("sha256", appSecret()).update(ip).digest("base64url").slice(0, 22);
}

/** Limite global diário (teto de gastos com a API), independente do IP. */
export function dailyCapRule(): Rule {
  return { max: config.tryon.dailyCap, windowSec: 86_400 };
}

export function _resetMemoryLimiter() {
  memory.clear();
}
