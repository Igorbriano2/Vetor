"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { criarProjetoCanvas } from "@/lib/canvas/criarProjeto";

export default function NovoProjetoCanvasBotao({ clienteId }: { clienteId: string }) {
  const [criando, setCriando] = useState(false);
  const router = useRouter();

  async function criar() {
    setCriando(true);
    const supabase = createSupabaseBrowserClient();
    const id = await criarProjetoCanvas(supabase, clienteId);
    setCriando(false);
    if (id) router.push(`/design/canvas/${id}`);
  }

  return (
    <button
      onClick={criar}
      disabled={criando}
      className="btn-tactile rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
    >
      {criando ? "Criando..." : "+ Novo projeto"}
    </button>
  );
}
