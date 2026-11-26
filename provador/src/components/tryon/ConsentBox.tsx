"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";

/** Consentimento específico e destacado para o uso da imagem (LGPD, art. 8º e art. 11). */
export function ConsentBox({ checked, onChange, large = false, kiosk = false }: { checked: boolean; onChange: (v: boolean) => void; large?: boolean; kiosk?: boolean }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${checked ? "border-ink bg-white" : "border-line bg-white/70 hover:border-ink/40"} ${large ? "p-6 text-base" : "text-sm"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 shrink-0 accent-[#17191d] ${large ? "h-7 w-7" : "h-5 w-5"}`}
      />
      <span className="leading-relaxed text-ink/85">
        Autorizo a {BRAND.nome} a usar esta foto <strong>somente para gerar a prova virtual</strong>
        {kiosk ? " e o link temporário do QR code" : ""}. A imagem é processada por um parceiro de IA, não é usada para outra finalidade e é apagada
        em até 24 h. Li a{" "}
        <Link href="/privacidade" target="_blank" className="font-semibold underline decoration-gold underline-offset-4">
          Política de Privacidade
        </Link>
        .
      </span>
    </label>
  );
}
