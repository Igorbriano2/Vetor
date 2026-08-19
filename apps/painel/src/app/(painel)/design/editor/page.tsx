"use client";

// Cria um design_project em branco e redireciona pro editor de verdade
// (/design/editor/[projectId]). Normalmente um projeto nasce de um pedido
// ao Vetor (agente de Design) — isto aqui cobre o caminho manual "começar
// do zero direto no painel", pedido explícito da spec ("o cliente deve
// conseguir... alterar propriedades").

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FORMATOS = [
  { label: "Feed quadrado (1080×1080)", width: 1080, height: 1080 },
  { label: "Stories/Reels (1080×1920)", width: 1080, height: 1920 },
  { label: "Paisagem (1920×1080)", width: 1920, height: 1080 },
];

export default function NovoDesignProjectPage() {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("Novo design");
  const [formato, setFormato] = useState(FORMATOS[0]!);

  async function criar() {
    setCriando(true);
    setErro(null);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErro("Sessão expirada — faça login de novo.");
      setCriando(false);
      return;
    }
    const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
    if (!usuario?.cliente_id) {
      setErro("Usuário ainda não está vinculado a um cliente.");
      setCriando(false);
      return;
    }

    const { data, error } = await supabase
      .from("design_projects")
      .insert({
        cliente_id: usuario.cliente_id,
        title: titulo.trim() || "Novo design",
        width: formato.width,
        height: formato.height,
        canvas_json: {},
        version: 1,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !data) {
      setErro(error?.message ?? "Falha ao criar o projeto");
      setCriando(false);
      return;
    }
    router.push(`/design/editor/${data.id as string}`);
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-md">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Novo design</h1>
        <p className="mt-2 text-sm text-areia/60">
          Começa em branco no editor — a maioria das peças nasce de um pedido ao Vetor no chat, isto é pra começar
          direto no painel.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm text-areia/70">
            Título
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-sm text-areia"
            />
          </label>
          <label className="block text-sm text-areia/70">
            Formato
            <select
              value={formato.label}
              onChange={(e) => setFormato(FORMATOS.find((f) => f.label === e.target.value) ?? FORMATOS[0]!)}
              className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-sm text-areia"
            >
              {FORMATOS.map((f) => (
                <option key={f.label} value={f.label}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          {erro && <p className="text-xs text-coral">{erro}</p>}

          <button
            type="button"
            onClick={criar}
            disabled={criando}
            className="w-full rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
          >
            {criando ? "Criando..." : "Criar e abrir editor"}
          </button>
        </div>
      </div>
    </div>
  );
}
