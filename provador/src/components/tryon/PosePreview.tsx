"use client";

import { useEffect, useRef } from "react";
import type { EstimateResult } from "@/lib/body/estimate";
import { POSE_CONNECTIONS } from "@/lib/client/pose";
import type { PhotoState } from "@/store/provador";
import { useProvador } from "@/store/provador";

/**
 * Mostra a foto com o que o MediaPipe detectou: esqueleto e as linhas onde
 * medimos ombros, peito, cintura e quadril. Transparência: o cliente vê
 * exatamente de onde vêm as medidas do avatar.
 */
export function PosePreview({ photo, className = "" }: { photo: PhotoState; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pose = useProvador((s) => s.pose);
  const status = useProvador((s) => s.poseStatus);
  const estimate = useProvador((s) => s.estimate);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = photo.width;
    c.height = photo.height;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!pose) return;
    drawOverlay(ctx, photo, pose.landmarks, estimate);
  }, [photo, pose, estimate]);

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-xl2)] bg-ink ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="Sua foto" className="block h-full w-full object-contain" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
      {status === "analisando" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-gold/25 to-gold/60" />
          <span className="absolute top-3 left-3 rounded-full bg-ink/80 px-3 py-1 text-[11px] font-semibold text-white">Analisando pose…</span>
        </div>
      )}
    </div>
  );
}

function drawOverlay(ctx: CanvasRenderingContext2D, photo: PhotoState, lm: { x: number; y: number; visibility?: number }[], est: EstimateResult | null) {
  const W = photo.width;
  const H = photo.height;
  const lw = Math.max(2, W / 260);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(199,169,107,0.9)";
  ctx.lineWidth = lw;
  for (const [a, b] of POSE_CONNECTIONS) {
    if ((lm[a].visibility ?? 1) < 0.5 || (lm[b].visibility ?? 1) < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(lm[a].x * W, lm[a].y * H);
    ctx.lineTo(lm[b].x * W, lm[b].y * H);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if ((lm[i].visibility ?? 1) < 0.5) continue;
    ctx.beginPath();
    ctx.arc(lm[i].x * W, lm[i].y * H, lw * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!est?.scanLines) return;
  ctx.font = `600 ${Math.max(12, W / 50)}px Inter, sans-serif`;
  for (const s of est.scanLines) {
    ctx.strokeStyle = s.measured ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)";
    ctx.setLineDash(s.measured ? [] : [lw * 3, lw * 2]);
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y);
    ctx.lineTo(s.x1, s.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const x of [s.x0, s.x1]) {
      ctx.beginPath();
      ctx.moveTo(x, s.y - lw * 3);
      ctx.lineTo(x, s.y + lw * 3);
      ctx.stroke();
    }
    const label = s.label;
    const tw = ctx.measureText(label).width;
    const pad = lw * 2;
    const fx = s.x1 + lw * 4;
    const fy = s.y;
    ctx.fillStyle = "rgba(23,25,29,0.8)";
    ctx.beginPath();
    ctx.roundRect(fx, fy - Math.max(12, W / 50), tw + pad * 2, Math.max(12, W / 50) * 1.5, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, fx + pad, fy + Math.max(12, W / 50) * 0.3);
  }
}
