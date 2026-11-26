/**
 * Ajustes de execução para a versão de demonstração estática (scripts/build-demo.mjs),
 * que roda sem servidor: arquivos com caminho relativo e prova sempre simulada.
 * No app Next.js normal, nada muda (base "/" e modo estático desligado).
 */
type DemoWindow = Window & { __ASSET_BASE__?: string; __STATIC_DEMO__?: boolean };

const w = typeof window !== "undefined" ? (window as DemoWindow) : undefined;

export const ASSET_BASE: string = w?.__ASSET_BASE__ || "/";
export const STATIC_DEMO: boolean = !!w?.__STATIC_DEMO__;

/** Caminho de um arquivo de public/ respeitando a base atual. */
export const asset = (path: string) => ASSET_BASE + path.replace(/^\//, "");

/**
 * Na demonstração estática, arquivos binários (modelos .glb, modelo de pose)
 * são publicados como JSON {"b64": "..."}, porque a hospedagem só serve tipos
 * web comuns. Esta função baixa o JSON e devolve os bytes originais.
 */
export async function fetchEmbeddedBinary(path: string): Promise<ArrayBuffer> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  const { b64 } = (await res.json()) as { b64: string };
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
