"use client";

import { useState } from "react";

/**
 * Gráficos do painel (série única → sem legenda; o título nomeia a série).
 * Cor da barra validada (contraste ≥ 3:1 e croma) contra o fundo branco.
 */
const BAR = "#b7852a";

export function DailyBars({ data }: { data: Array<{ dia: string; total: number }> }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const W = 640;
  const H = 180;
  const padB = 24;
  const padT = 12;
  const gap = 2;
  const bw = W / data.length;
  const ticks = [0, Math.ceil(max / 2), max];
  const fmt = (d: string) => {
    const [, m, dd] = d.split("-");
    return `${dd}/${m}`;
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label="Provas com foto por dia nos últimos 14 dias">
        {ticks.map((t) => {
          const y = H - padB - (t / max) * (H - padB - padT);
          return (
            <g key={t}>
              <line x1={0} x2={W} y1={y} y2={y} stroke="#e4e1da" strokeWidth={1} />
              <text x={W} y={y - 3} textAnchor="end" fontSize={10} fill="#6b6f78">
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.total / max) * (H - padB - padT);
          const x = i * bw + gap / 2 + bw * 0.15;
          const w = bw * 0.7 - gap;
          const y = H - padB - h;
          const r = Math.min(4, h / 2, w / 2);
          return (
            <g key={d.dia} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {d.total > 0 && (
                <path
                  d={`M${x},${H - padB} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${H - padB} Z`}
                  fill={BAR}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {(i % 2 === data.length % 2 || i === data.length - 1) && (
                <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b6f78">
                  {fmt(d.dia)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="#c9c5bc" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          <strong className="tabular-nums">{data[hover].total}</strong> {data[hover].total === 1 ? "prova" : "provas"} · {fmt(data[hover].dia)}
        </div>
      )}
    </div>
  );
}

export function ShirtBars({ rows }: { rows: Array<{ shirtId: string; nome: string; foto: number; v360: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.foto));
  if (!rows.length) return <p className="text-sm text-muted">Nenhuma camisa cadastrada.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs tracking-wide text-muted uppercase">
          <th className="pb-2 font-semibold">Camisa</th>
          <th className="w-[40%] pb-2 font-semibold">Provas com foto</th>
          <th className="pb-2 text-right font-semibold">Vistas 360°</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.shirtId} className="border-t border-line" title={`${r.nome}: ${r.foto} provas com foto, ${r.v360} trocas no 360°`}>
            <td className="py-2.5 pr-3 font-medium">{r.nome}</td>
            <td className="py-2.5 pr-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1 rounded-r bg-[#f1eee8]">
                  <div className="h-full rounded-r" style={{ width: `${(r.foto / max) * 100}%`, background: BAR, minWidth: r.foto ? 4 : 0 }} />
                </div>
                <span className="w-8 text-right tabular-nums">{r.foto}</span>
              </div>
            </td>
            <td className="py-2.5 text-right tabular-nums text-muted">{r.v360}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
