// Prepara os arquivos do MediaPipe em /public para que a detecção de pose rode
// sem depender de CDN de terceiros (importante no modo loja/quiosque):
//  1. copia o WASM do pacote @mediapipe/tasks-vision (versão sempre compatível);
//  2. tenta baixar o modelo pose_landmarker_full.task (~9 MB). Se falhar, o
//     navegador usa a URL oficial do Google como alternativa (ver src/lib/pose).
import { cpSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const destDir = join(root, "public", "mediapipe");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

if (!existsSync(src)) {
  console.warn("[mediapipe] pacote não encontrado; pulando cópia do WASM.");
  process.exit(0);
}
mkdirSync(join(destDir, "wasm"), { recursive: true });
cpSync(src, join(destDir, "wasm"), { recursive: true });
console.log("[mediapipe] WASM copiado para public/mediapipe/wasm");

const modelPath = join(destDir, "pose_landmarker_full.task");
if (existsSync(modelPath) && statSync(modelPath).size > 1_000_000) {
  console.log("[mediapipe] modelo de pose já presente");
} else if (process.env.SKIP_POSE_MODEL_DOWNLOAD) {
  console.log("[mediapipe] download do modelo pulado (SKIP_POSE_MODEL_DOWNLOAD)");
} else {
  try {
    const res = await fetch(MODEL_URL, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
    console.log("[mediapipe] modelo de pose baixado para public/mediapipe");
  } catch (err) {
    console.warn(`[mediapipe] não foi possível baixar o modelo (${err.message}); o navegador usará a CDN do Google.`);
  }
}
