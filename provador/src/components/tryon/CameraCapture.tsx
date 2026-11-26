"use client";

import { Camera, RefreshCcw, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoGuideOverlay } from "./PhotoGuide";

interface Props {
  onCapture: (blob: Blob) => void;
  onCancel?: () => void;
  /** botões grandes (modo loja) */
  large?: boolean;
  defaultTimer?: 0 | 3 | 10;
  className?: string;
  /** quando definido, dispara a captura (com o timer) ao mudar */
  triggerKey?: number;
  hideControls?: boolean;
  showGuide?: boolean;
}

/**
 * Câmera via getUserMedia. A prévia é espelhada (como um espelho), mas a foto
 * capturada não — assim estampas e textos saem na orientação correta.
 */
export function CameraCapture({ onCapture, onCancel, large = false, defaultTimer = 3, className = "", triggerKey, hideControls, showGuide = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [timer, setTimer] = useState<0 | 3 | 10>(defaultTimer);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [multiCam, setMultiCam] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    setError(null);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador não permite usar a câmera. Envie uma foto da galeria.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setMultiCam(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err) {
        const name = (err as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "Permita o acesso à câmera nas configurações do navegador, ou envie uma foto."
            : name === "NotFoundError"
              ? "Nenhuma câmera encontrada. Envie uma foto da galeria."
              : "Não foi possível abrir a câmera. Envie uma foto da galeria.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const snap = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.92);
  }, [onCapture]);

  const start = useCallback(() => {
    if (count !== null) return;
    if (!timer) return snap();
    setCount(timer);
  }, [count, timer, snap]);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      setCount(null);
      snap();
      return;
    }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [count, snap]);

  useEffect(() => {
    if (triggerKey) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  const btn = large ? "h-16 w-16" : "h-11 w-11";

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-xl2)] bg-ink ${className}`}>
      <video
        ref={videoRef}
        playsInline
        muted
        onLoadedData={() => setReady(true)}
        className="h-full w-full object-cover"
        style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
      />
      {ready && showGuide && <PhotoGuideOverlay className="absolute inset-0 h-full w-full p-[6%]" />}
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-gold" /> Abrindo a câmera…
          </span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/85">
          <p className="max-w-xs">{error}</p>
        </div>
      )}
      {count !== null && count > 0 && (
        <div className="absolute inset-0 grid place-items-center bg-black/20">
          <span key={count} className={`animate-fade-up font-display font-bold text-white drop-shadow-lg ${large ? "text-[12rem]" : "text-8xl"}`}>
            {count}
          </span>
        </div>
      )}
      {flash && <div className="absolute inset-0 bg-white" />}
      {!hideControls && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
          <div className="flex gap-2">
            {onCancel && (
              <button onClick={onCancel} className={`${btn} grid place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25`} aria-label="Fechar câmera">
                <X className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))}
              className={`${btn} relative grid place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25`}
              aria-label={`Temporizador: ${timer ? `${timer} segundos` : "desligado"}`}
            >
              <Timer className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 rounded-full bg-gold px-1.5 text-[10px] font-bold text-ink">{timer ? `${timer}s` : "off"}</span>
            </button>
          </div>
          <button
            onClick={start}
            disabled={!ready || count !== null}
            className={`grid place-items-center rounded-full border-4 border-white bg-gold text-ink shadow-lg transition active:scale-95 disabled:opacity-50 ${large ? "h-24 w-24 animate-pulse-ring" : "h-16 w-16"}`}
            aria-label="Tirar foto"
          >
            <Camera className={large ? "h-10 w-10" : "h-7 w-7"} />
          </button>
          <div className="flex gap-2">
            {multiCam ? (
              <button
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                className={`${btn} grid place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25`}
                aria-label="Trocar câmera"
              >
                <RefreshCcw className="h-5 w-5" />
              </button>
            ) : (
              <span className={btn} />
            )}
            {onCancel && <span className={btn} />}
          </div>
        </div>
      )}
    </div>
  );
}
