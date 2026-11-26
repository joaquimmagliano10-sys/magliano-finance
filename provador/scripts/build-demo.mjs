// Gera a versão de demonstração ESTÁTICA do provador em demo-dist/:
// uma página única (sem servidor) com catálogo, prévia simulada e 360°.
// Útil para mostrar o projeto antes do deploy. Uso: npm run demo:build
import tailwind from "@tailwindcss/postcss";
import * as esbuild from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

const root = process.cwd();
const out = join(root, "demo-dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await esbuild.build({
  entryPoints: ["demo/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: join(out, "app.js"),
  jsx: "automatic",
  alias: { "next/link": "./demo/shims/next-link.tsx", "next/dynamic": "./demo/shims/next-dynamic.tsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: "var process=globalThis.process||{env:{}};" },
  logLevel: "warning",
  logOverride: { "module-level-directive": "silent" },
});

const css = (
  await postcss([tailwind({ optimize: { minify: true } })]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: join(root, "src/app/globals.css"),
  })
).css;

// A hospedagem do claude.ai só serve tipos web comuns: binários vão como JSON base64.
const embed = (src, dest) => writeFileSync(dest, JSON.stringify({ b64: readFileSync(src).toString("base64") }));
cpSync(join(root, "public", "seed"), join(out, "seed"), { recursive: true });
mkdirSync(join(out, "models"), { recursive: true });
for (const f of ["manequim-masculino.glb", "manequim-feminino.glb", "camiseta-base.glb"]) {
  embed(join(root, "public/models", f), join(out, "models", `${f}.json`));
}
mkdirSync(join(out, "mediapipe", "wasm"), { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) {
  cpSync(join(root, "public/mediapipe/wasm", f), join(out, "mediapipe/wasm", f));
}
const model = join(root, "public/mediapipe/pose_landmarker_full.task");
if (!existsSync(model)) throw new Error("Modelo de pose ausente: rode npm install (postinstall baixa o arquivo).");
embed(model, join(out, "mediapipe/pose-model.json"));

writeFileSync(
  join(out, "index.html"),
  `<title>Provador VESTE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap">
<style>:root{--font-inter:"Inter";--font-display-face:"Space Grotesk"}${css}</style>
<div id="root"></div>
<script>window.__ASSET_BASE__="./";window.__STATIC_DEMO__=true;</script>
<script src="app.js"></script>
`,
);
console.log("✔ demo-dist/ gerado");
