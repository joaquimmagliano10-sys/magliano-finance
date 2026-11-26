/**
 * Substituto de `next/link` na demonstração estática: converte as rotas do app
 * em âncoras de hash (#provar-..., #privacidade), já que a página publicada é
 * um arquivo único sem servidor.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

export function toDemoHref(href: string): string {
  if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) return href;
  if (href.startsWith("#")) return href;
  const [path, query = ""] = href.split("?");
  if (path === "/" || path === "") return "#inicio";
  if (path.startsWith("/#")) return path.slice(1);
  const m = /^\/provar\/([a-z0-9-]+)/.exec(path);
  if (m) {
    const cor = new URLSearchParams(query).get("cor");
    return `#provar-${m[1]}${cor ? `--${cor}` : ""}`;
  }
  if (path.startsWith("/privacidade")) return "#privacidade";
  return "#loja";
}

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode; prefetch?: boolean };

export default function Link({ href, target, prefetch: _p, ...rest }: Props) {
  void _p;
  const to = toDemoHref(href);
  const external = /^https?:\/\//.test(to);
  return <a href={to} target={external ? target : undefined} rel={external ? "noreferrer" : undefined} {...rest} />;
}
