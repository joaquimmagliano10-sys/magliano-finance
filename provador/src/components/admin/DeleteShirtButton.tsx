"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteShirtButton({ id, nome, redirectTo }: { id: string; nome: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      className="chip !text-danger"
      onClick={async () => {
        if (!confirm(`Remover "${nome}" do catálogo? Esta ação não pode ser desfeita.`)) return;
        setBusy(true);
        const res = await fetch(`/api/admin/camisas/${id}`, { method: "DELETE" });
        setBusy(false);
        if (!res.ok) return alert("Não foi possível remover.");
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      }}
    >
      <Trash2 className="h-3.5 w-3.5" /> Remover
    </button>
  );
}
