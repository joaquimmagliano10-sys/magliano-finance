import type { Metadata } from "next";
import { KioskApp } from "@/components/kiosk/KioskApp";
import { repo } from "@/lib/db";
import { toPublicShirt } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Provador da loja", robots: { index: false } };

export default async function LojaPage() {
  const shirts = (await repo().listShirts()).map(toPublicShirt);
  return <KioskApp shirts={shirts} />;
}
