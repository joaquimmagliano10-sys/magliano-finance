"use client";

import dynamic from "next/dynamic";

/** O 3D só existe no navegador: carregamos sob demanda (sem SSR), com um placeholder leve. */
export const LazyViewer360 = dynamic(() => import("./Viewer360").then((m) => m.Viewer360), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-gold" />
    </div>
  ),
});
