"use client";

import { useEffect } from "react";
import { estimateMeasurements } from "@/lib/body/estimate";
import { defaultBodyForSize } from "@/lib/body/morphs";
import { loadImage } from "@/lib/client/images";
import { analyzePose } from "@/lib/client/pose";
import { useProvador } from "@/store/provador";

/**
 * Quando há foto: detecta pose + silhueta (no aparelho) e estima as medidas.
 * Quando o cliente muda o modelo do avatar ou a altura, recalcula.
 * Se a detecção falhar, usa o avatar padrão do tamanho escolhido.
 */
export function usePoseEstimate() {
  const photo = useProvador((s) => s.photo);
  const pose = useProvador((s) => s.pose);
  const sexo = useProvador((s) => s.sexo);
  const alturaCm = useProvador((s) => s.alturaCm);
  const size = useProvador((s) => s.size);
  const set = useProvador((s) => s.set);

  useEffect(() => {
    if (!photo) return;
    let alive = true;
    set({ poseStatus: "analisando", pose: null, estimate: null });
    (async () => {
      try {
        const img = await loadImage(photo.url);
        const result = await analyzePose(img);
        if (!alive) return;
        set({ pose: result, poseStatus: result ? "ok" : "falhou" });
      } catch (err) {
        console.warn("[pose]", err);
        if (alive) set({ pose: null, poseStatus: "falhou" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [photo, set]);

  useEffect(() => {
    const st = useProvador.getState();
    if (st.measurementsSource === "manual") return;
    const altura = alturaCm && alturaCm >= 120 && alturaCm <= 230 ? alturaCm / 100 : undefined;
    if (pose && photo) {
      const est = estimateMeasurements({
        landmarks: pose.landmarks,
        mask: pose.mask,
        imageWidth: photo.width,
        imageHeight: photo.height,
        sexo,
        altura,
      });
      if (est.ok) {
        set({ estimate: est, measurements: est.measurements, measurementsSource: "foto" });
        return;
      }
      set({ estimate: est });
    }
    if (st.poseStatus !== "analisando") {
      set({ measurements: defaultBodyForSize(sexo, size ?? "M", altura), measurementsSource: "padrao" });
    }
  }, [pose, photo, sexo, alturaCm, size, set]);
}
