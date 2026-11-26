import "server-only";

/**
 * Configuração do servidor (variáveis de ambiente). Nada aqui vai para o navegador.
 * Veja .env.example para a descrição de cada variável.
 */
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

function parseRule(v: string | undefined, d: { max: number; windowSec: number }) {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(v ?? "");
  return m ? { max: Number(m[1]), windowSec: Number(m[2]) } : d;
}

const isProd = process.env.NODE_ENV === "production";
const onVercel = !!process.env.VERCEL;

let warnedSecret = false;
export function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd && onVercel) throw new Error("APP_SECRET ausente ou curta (mínimo 32 caracteres).");
  if (!warnedSecret) {
    console.warn("[config] APP_SECRET não definida — usando segredo de desenvolvimento. NÃO use assim em produção.");
    warnedSecret = true;
  }
  return "dev-secret-nao-use-em-producao-0123456789abcdef";
}

export const config = {
  isProd,
  onVercel,
  tryon: {
    provider: (process.env.TRYON_PROVIDER || "auto").toLowerCase(),
    rateLimit: parseRule(process.env.TRYON_RATE_LIMIT, { max: 5, windowSec: 600 }),
    kioskRateLimit: parseRule(process.env.KIOSK_RATE_LIMIT, { max: 120, windowSec: 3600 }),
    dailyCap: num(process.env.TRYON_DAILY_CAP, 300),
    maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 8) * 1024 * 1024,
    /** tempo máximo que esperamos pelo provedor antes de desistir */
    jobTtlSec: 180,
  },
  fashn: {
    apiKey: process.env.FASHN_API_KEY || "",
    model: process.env.FASHN_MODEL || "tryon-v1.6",
    mode: process.env.FASHN_MODE || "balanced",
  },
  fal: { key: process.env.FAL_KEY || "", model: process.env.FAL_TRYON_MODEL || "fal-ai/kling/v1-5/kolors-virtual-try-on" },
  replicate: { token: process.env.REPLICATE_API_TOKEN || "", version: process.env.REPLICATE_MODEL_VERSION || "" },
  kioskToken: process.env.KIOSK_TOKEN || "",
  resultTtlMinutes: Math.min(24 * 60, num(process.env.RESULT_TTL_MINUTES, 30)),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  blobToken: process.env.BLOB_READ_WRITE_TOKEN || "",
  upstash: { url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "", token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "" },
  cronSecret: process.env.CRON_SECRET || "",
  admin: {
    email: (process.env.ADMIN_EMAIL || "admin@loja.com").toLowerCase(),
    passwordHash: process.env.ADMIN_PASSWORD_HASH || "",
    password: process.env.ADMIN_PASSWORD || (isProd ? "" : "admin123"),
  },
};
