import { BRAND } from "@/lib/brand";

/** Logo provisório (monograma). Substitua pelo SVG da sua marca. */
export function Logo({ className = "", light = false, showName = true }: { className?: string; light?: boolean; showName?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill={light ? "#c7a96b" : "#17191d"} />
        <path d="M18 18h7.5L32 38.5 38.5 18H46L35.6 46h-7.2z" fill={light ? "#17191d" : "#c7a96b"} />
      </svg>
      {showName && (
        <span className={`font-display text-lg leading-none font-bold tracking-[0.18em] ${light ? "text-white" : "text-ink"}`}>
          {BRAND.nome}
        </span>
      )}
    </span>
  );
}
