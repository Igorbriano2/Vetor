"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Fase 8 do reset de produto — só renderizado pra admin_vetor (ver
// SidebarNav.tsx). Troca só o cookie que resolverClienteAtivo.ts lê — a
// rota /api/workspace recusa a troca pra qualquer papel que não seja
// admin_vetor, então isto nunca é a única defesa.
export default function WorkspaceSwitcher({
  workspaceAtivoId,
  workspaces,
}: {
  workspaceAtivoId: string | null;
  workspaces: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);

  async function trocar(clienteId: string) {
    if (!clienteId || clienteId === workspaceAtivoId) return;
    setTrocando(true);
    try {
      await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId }),
      });
      router.refresh();
    } finally {
      setTrocando(false);
    }
  }

  return (
    <select
      value={workspaceAtivoId ?? ""}
      onChange={(e) => trocar(e.target.value)}
      disabled={trocando}
      className="mono-label mt-2 w-full truncate rounded-lg border border-areia/15 bg-petroleo-2 px-2 py-1.5 text-areia disabled:opacity-50"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.nome}
        </option>
      ))}
    </select>
  );
}
