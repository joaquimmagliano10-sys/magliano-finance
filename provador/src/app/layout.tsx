import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display-face", display: "swap", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: { default: `${BRAND.nome} · Provador virtual`, template: `%s · ${BRAND.nome}` },
  description: BRAND.descricao,
  applicationName: `${BRAND.nome} Provador`,
  icons: { icon: "/logo.svg" },
  openGraph: { title: `${BRAND.nome} · Provador virtual`, description: BRAND.descricao, locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17191d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
