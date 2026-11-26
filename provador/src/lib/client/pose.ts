"use client";

import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Landmark, MaskData } from "../body/estimate";

/**
 * Detecção de pose + silhueta com MediaPipe Pose Landmarker, 100% no navegador:
 * a foto não sai do aparelho para esta etapa.
 *
 * WASM e modelo são servidos do próprio site (public/mediapipe, preparados no
 * `npm install`). Se o modelo local não existir, usamos a URL oficial do Google.
 */
const LOCAL_MODEL = "/mediapipe/pose_landmarker_full.task";
const CDN_MODEL =
  process.env.NEXT_PUBLIC_POSE_MODEL_URL ||
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const local = await fetch(LOCAL_MODEL, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
    const modelAssetPath = local ? LOCAL_MODEL : CDN_MODEL;
    const create = (delegate: "GPU" | "CPU") =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: "IMAGE",
        numPoses: 1,
        outputSegmentationMasks: true,
        minPoseDetectionConfidence: 0.5,
      });
    try {
      return await create("GPU");
    } catch {
      return await create("CPU");
    }
  })().catch((err) => {
    landmarkerPromise = null;
    throw err;
  });
  return landmarkerPromise;
}

export interface PoseAnalysis {
  landmarks: Landmark[];
  mask: MaskData | null;
}

/** Roda a detecção numa imagem. Retorna null se nenhuma pessoa for encontrada. */
export async function analyzePose(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<PoseAnalysis | null> {
  const landmarker = await getPoseLandmarker();
  const res = landmarker.detect(image);
  try {
    const lm = res.landmarks?.[0];
    if (!lm || lm.length < 33) return null;
    let mask: MaskData | null = null;
    const m = res.segmentationMasks?.[0];
    if (m) mask = { data: new Float32Array(m.getAsFloat32Array()), width: m.width, height: m.height };
    return { landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })), mask };
  } finally {
    res.segmentationMasks?.forEach((m) => m.close());
  }
}

/** Conexões para desenhar o "esqueleto" sobre a foto. */
export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [28, 30], [0, 11], [0, 12],
];
