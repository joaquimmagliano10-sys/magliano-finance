import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TryOnFlow } from "@/components/tryon/TryOnFlow";
import { repo } from "@/lib/db";
import { toPublicShirt } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ cor?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shirt = await repo().getShirtBySlug(slug);
  return { title: shirt ? `Provar ${shirt.nome}` : "Provar", robots: { index: false } };
}

export default async function ProvarPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { cor } = await searchParams;
  const shirts = (await repo().listShirts()).map(toPublicShirt);
  const shirt = shirts.find((s) => s.slug === slug);
  if (!shirt) notFound();
  return <TryOnFlow shirts={shirts} initialShirtId={shirt.id} initialColorId={cor} />;
}
