import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { Logo } from "@/components/Logo";
import { currentAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin">
              <Logo />
            </Link>
            <nav className="hidden gap-1 text-sm font-semibold sm:flex">
              <Link href="/admin" className="rounded-full px-3 py-2 hover:bg-black/5">
                Painel
              </Link>
              <Link href="/admin/camisas/nova" className="rounded-full px-3 py-2 hover:bg-black/5">
                Nova camisa
              </Link>
              <Link href="/" target="_blank" className="rounded-full px-3 py-2 hover:bg-black/5">
                Ver site
              </Link>
              <Link href="/loja" target="_blank" className="rounded-full px-3 py-2 hover:bg-black/5">
                Modo loja
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted md:inline">{admin.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
