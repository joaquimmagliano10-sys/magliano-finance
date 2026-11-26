/** Silhueta-guia sobre a câmera: de frente, braços levemente afastados. */
export function PhotoGuideOverlay({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 400" className={`pointer-events-none ${className}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g fill="none" stroke="white" strokeWidth="2.2" strokeDasharray="7 6" opacity="0.85">
        <ellipse cx="150" cy="62" rx="27" ry="34" />
        <path d="M128 92 Q150 104 172 92 L176 106 Q214 110 226 128 L250 236 M124 106 Q86 110 74 128 L50 236" />
        <path d="M100 128 L104 232 Q106 262 110 300 L112 392 M200 128 L196 232 Q194 262 190 300 L188 392" />
        <path d="M110 300 Q150 312 190 300" />
      </g>
    </svg>
  );
}

export const PHOTO_TIPS = [
  "Corpo inteiro ou da cintura para cima",
  "De frente para a câmera",
  "Braços levemente afastados do corpo",
  "Boa iluminação, sem contraluz",
  "Roupa justa ajuda a medir melhor",
];

export function PhotoTips({ dark = false }: { dark?: boolean }) {
  return (
    <ul className={`grid gap-2 text-sm ${dark ? "text-white/80" : "text-ink/80"}`}>
      {PHOTO_TIPS.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          {t}
        </li>
      ))}
    </ul>
  );
}
