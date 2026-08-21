"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { grafoVazio } from "@/lib/canvas/types";

export default function NovoProjetoCanvasBotao({ clienteId }: { clienteId: string }) {
  const [criando, setCriando] = useState(false);
  const router = useRouter();

  async function criar() {
    setCriando(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("creative_canvas_projects")
      .insert({ cliente_id: clienteId, title: "Novo projeto de canvas", graph_json: grafoVazio() })
      .select("id")
      .single();
    setCriando(false);
    if (!error && data) router.push(`/criacoes/canvas/${data.id as string}`);
  }

  return (
    <button
      onClick={criar}
      disabled={criando}
      className="rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
    >
      {criando ? "Criando..." : "+ Novo projeto"}
    </button>
  );
}
