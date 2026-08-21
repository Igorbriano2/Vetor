"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { criarProjetoCanvas } from "@/lib/canvas/criarProjeto";
import { RECEITAS_AGENCIA, queryDaReceita } from "@/lib/design/receitasAgencia";

interface Opcao {
  id: string;
  titulo: string;
  descricao: string;
  emoji: string;
}

const OPCOES: Opcao[] = [
  { id: "vetor", titulo: "Começar com o VETOR", descricao: "Conversa e o Vetor monta o fluxo pra você.", emoji: "◈" },
  { id: "zero", titulo: "Começar do zero", descricao: "Canvas vazio — você monta o pipeline do seu jeito.", emoji: "▢" },
  { id: "receita", titulo: "Usar uma receita", descricao: "Receitas visuais prontas de agência.", emoji: "▤" },
  { id: "referencia", titulo: "Usar uma referência", descricao: "Biblioteca visual — sua ou curada pelo Vetor.", emoji: "◐" },
];

// Design V2 Fase 2 — "Como você quer começar?" é o único ponto de entrada
// pra um novo projeto de Criações. Cada opção reaproveita um caminho já
// real (chat do Vetor, Creative Canvas, /templates, /referencias) — nunca
// um quinto fluxo de criação novo.
export default function NovoProjetoModal({ clienteId, onFechar }: { clienteId: string; onFechar: () => void }) {
  const [criando, setCriando] = useState(false);
  const [mostrarReceitas, setMostrarReceitas] = useState(false);
  const router = useRouter();

  async function escolher(opcao: string) {
    if (opcao === "vetor") {
      router.push("/vetor");
      return;
    }
    if (opcao === "zero") {
      setCriando(true);
      const supabase = createSupabaseBrowserClient();
      const id = await criarProjetoCanvas(supabase, clienteId);
      setCriando(false);
      if (id) router.push(`/criacoes/canvas/${id}`);
      return;
    }
    if (opcao === "receita") {
      setMostrarReceitas(true);
      return;
    }
    if (opcao === "referencia") {
      router.push("/referencias");
      return;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-petroleo/80 backdrop-blur-sm p-4" onClick={onFechar}>
      <div
        className="w-full max-w-2xl rounded-3xl border border-areia/10 bg-petroleo-2/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-areia">
            {mostrarReceitas ? "Qual receita você quer usar?" : "Como você quer começar?"}
          </h2>
          <button onClick={onFechar} className="text-areia/40 transition hover:text-areia" aria-label="Fechar">
            ✕
          </button>
        </div>

        {mostrarReceitas ? (
          <>
            <button
              type="button"
              onClick={() => setMostrarReceitas(false)}
              className="mt-3 font-mono text-[11px] uppercase tracking-wide text-areia/40 hover:text-areia"
            >
              ← voltar
            </button>
            <div className="mt-3 grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
              {RECEITAS_AGENCIA.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push(`/design?${queryDaReceita(r)}`)}
                  className="flex flex-col gap-1 rounded-2xl border border-areia/10 bg-petroleo-3/50 p-4 text-left transition hover:border-menta/40 hover:bg-petroleo-3/80"
                >
                  <p className="text-sm font-semibold text-areia">{r.nome}</p>
                  <p className="text-xs text-areia/50">{r.descricao}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => router.push("/templates")}
              className="mt-4 font-mono text-[11px] text-menta underline underline-offset-2 hover:text-menta-forte"
            >
              ver meus templates salvos
            </button>
          </>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {OPCOES.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={criando}
                onClick={() => escolher(o.id)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-areia/10 bg-petroleo-3/50 p-5 text-left transition hover:border-menta/40 hover:bg-petroleo-3/80 disabled:opacity-40"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-menta/30 bg-menta/10 text-lg text-menta">
                  {o.emoji}
                </span>
                <p className="text-sm font-semibold text-areia">{o.titulo}</p>
                <p className="text-xs text-areia/50">{o.descricao}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
