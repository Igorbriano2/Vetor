"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readApiResponse } from "@/lib/api/readApiResponse";

interface RespostaMissao {
  missionId: string;
  idempotente: boolean;
}

type TipoAnalise = "geral" | "rota" | "campanha";

const TIPOS: Array<{ valor: TipoAnalise; label: string; ajuda: string }> = [
  { valor: "geral", label: "Diagnóstico geral", ajuda: "Análise da situação atual do negócio" },
  { valor: "rota", label: "Análise + rota de ação", ajuda: "Diagnóstico completo com passo a passo estruturado" },
  { valor: "campanha", label: "Diagnóstico de campanha", ajuda: "Avaliar uma campanha ou ação específica já em curso" },
];

// Mesmo padrão real de CriarPecaWizard.tsx (Design): monta um
// PlanoConfirmado com uma etapa do agente `estrategia` e reusa o caminho já
// existente de criação de missão (POST /api/missoes → criarMissaoDeIntencao)
// — nunca um endpoint paralelo. Quando o tipo é "rota", a tarefa precisa
// dizer explicitamente "análise + rota/plano de ação estruturado" — é esse
// texto que apps/agentes/src/agents/prompts/estrategia.md lê pra decidir se
// preenche o campo `rota` (relatório executivo) em vez de um plano simples
// (ver apps/agentes/src/agents/prompts/vetor.md, mesma regra).
export default function NovaAnaliseWizard({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoAnalise>("rota");
  const [contexto, setContexto] = useState("");
  const [status, setStatus] = useState<"formulario" | "enviando" | "confirmada" | "erro">("formulario");
  const [erro, setErro] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);

  async function confirmar() {
    setStatus("enviando");
    setErro(null);

    const tarefa =
      tipo === "rota"
        ? `Cliente pediu uma análise completa da situação do negócio com uma rota/plano de ação estruturado. ${contexto.trim()}`.trim()
        : tipo === "campanha"
          ? `Diagnosticar a campanha/ação específica descrita pelo cliente e recomendar ajustes. ${contexto.trim()}`.trim()
          : `Fazer um diagnóstico geral da situação atual do negócio. ${contexto.trim()}`.trim();

    const plano = {
      titulo: `Estratégia — ${(contexto.trim() || TIPOS.find((t) => t.valor === tipo)!.label).slice(0, 60)}`,
      objetivo: contexto.trim() || TIPOS.find((t) => t.valor === tipo)!.label,
      criterioSucesso:
        tipo === "rota"
          ? ["Diagnóstico completo entregue", "Rota/plano de ação passo a passo entregue com prioridades claras"]
          : ["Diagnóstico entregue com recomendações claras"],
      etapas: [
        {
          chave: "estrategia-1",
          agente: "estrategia",
          tarefa,
          dependeDe: [],
          ferramentas: ["ler_perfil_negocio", "ler_historico"],
        },
      ],
    };

    try {
      const res = await fetch("/api/missoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const data = await readApiResponse<RespostaMissao>(res);
      setMissionId(data.missionId);
      setStatus("confirmada");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui criar a análise agora.");
      setStatus("erro");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-petroleo/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-areia/10 bg-petroleo-2 p-6 shadow-2xl">
        {status === "confirmada" && missionId ? (
          <div>
            <p className="mono-label text-menta">Missão criada</p>
            <h2 className="mt-2 text-lg font-semibold text-areia">Vou preparar essa análise e avisar quando estiver pronta.</h2>
            <p className="mt-2 text-sm text-areia/60">Acompanhe o andamento e o resultado na tela da missão.</p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href={`/missoes/${missionId}`}
                className="rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
              >
                Acompanhar
              </Link>
              <button onClick={onFechar} className="text-sm text-areia/50 hover:text-areia">
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="mono-label text-areia/40">Nova análise estratégica</p>
              <button onClick={onFechar} className="text-areia/40 hover:text-areia" aria-label="Fechar">
                ✕
              </button>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-areia">Que tipo de análise?</h2>
            <div className="mt-3 flex flex-col gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  onClick={() => setTipo(t.valor)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    tipo === t.valor ? "border-menta bg-menta/10" : "border-areia/15 hover:border-menta/40"
                  }`}
                >
                  <p className="text-sm font-medium text-areia">{t.label}</p>
                  <p className="mt-0.5 text-xs text-areia/40">{t.ajuda}</p>
                </button>
              ))}
            </div>

            <h2 className="mt-6 text-lg font-semibold text-areia">Contexto (opcional)</h2>
            <textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Ex: as vendas caíram nos últimos meses, quero entender por quê e o que fazer..."
              rows={3}
              className="mt-3 w-full rounded-xl border border-areia/15 bg-petroleo px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
            />

            {erro && <p className="mt-3 text-xs text-coral">{erro}</p>}

            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={confirmar}
                disabled={status === "enviando"}
                className="rounded-full bg-ambar px-5 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
              >
                {status === "enviando" ? "Criando..." : "Confirmar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
