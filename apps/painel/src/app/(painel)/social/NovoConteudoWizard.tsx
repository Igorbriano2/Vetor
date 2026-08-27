"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readApiResponse } from "@/lib/api/readApiResponse";

interface RespostaMissao {
  missionId: string;
  idempotente: boolean;
}

type TipoConteudo = "post" | "calendario" | "reativacao";

const TIPOS: Array<{ valor: TipoConteudo; label: string; ajuda: string }> = [
  { valor: "post", label: "Post ou promoção pontual", ajuda: "Legenda + copy pra divulgar uma oferta ou novidade" },
  { valor: "calendario", label: "Calendário de conteúdo", ajuda: "Sequência de posts pra um período (ex: 4 semanas)" },
  { valor: "reativacao", label: "Reativação de clientes", ajuda: "Comunicação pra trazer de volta quem já comprou" },
];

// Mesmo padrão real de NovaAnaliseWizard.tsx (Estratégia): monta um
// PlanoConfirmado com uma etapa do agente `social-media` e reusa o caminho
// já existente de criação de missão (POST /api/missoes →
// criarMissaoDeIntencao) — nunca um endpoint paralelo.
export default function NovoConteudoWizard({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoConteudo>("post");
  const [contexto, setContexto] = useState("");
  const [status, setStatus] = useState<"formulario" | "enviando" | "confirmada" | "erro">("formulario");
  const [erro, setErro] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);

  async function confirmar() {
    setStatus("enviando");
    setErro(null);

    const tarefa =
      tipo === "calendario"
        ? `Cliente pediu um calendário de conteúdo para as redes sociais. ${contexto.trim()}`.trim()
        : tipo === "reativacao"
          ? `Cliente pediu uma comunicação de reativação para clientes inativos. ${contexto.trim()}`.trim()
          : `Cliente pediu um post/promoção pontual para as redes sociais. ${contexto.trim()}`.trim();

    const plano = {
      titulo: `Social — ${(contexto.trim() || TIPOS.find((t) => t.valor === tipo)!.label).slice(0, 60)}`,
      objetivo: contexto.trim() || TIPOS.find((t) => t.valor === tipo)!.label,
      criterioSucesso: ["Nome/gancho criativo definido", "Copy com CTA claro entregue", "Formato pra feed e stories recomendado"],
      etapas: [
        {
          chave: "social-1",
          agente: "social-media",
          tarefa,
          dependeDe: [],
          ferramentas: ["ler_perfil_negocio", "criar_copy"],
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
      setErro(err instanceof Error ? err.message : "Não consegui criar o conteúdo agora.");
      setStatus("erro");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-petroleo/80 p-4 backdrop-blur-sm">
      <div className="liquid-glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6">
        {status === "confirmada" && missionId ? (
          <div>
            <p className="mono-label text-menta">Missão criada</p>
            <h2 className="mt-2 text-lg font-semibold text-areia">Vou preparar esse conteúdo e avisar quando estiver pronto.</h2>
            <p className="mt-2 text-sm text-areia/60">Acompanhe o andamento e o resultado na tela da missão.</p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href={`/missoes/${missionId}`}
                className="btn-tactile rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
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
              <p className="mono-label text-areia/40">Novo conteúdo</p>
              <button onClick={onFechar} className="text-areia/40 hover:text-areia" aria-label="Fechar">
                ✕
              </button>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-areia">Que tipo de conteúdo?</h2>
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
              placeholder="Ex: divulgar o combo de terça, R$ 39,90, válido essa semana..."
              rows={3}
              className="mt-3 w-full rounded-xl border border-areia/15 bg-petroleo px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
            />

            {erro && <p className="mt-3 text-xs text-coral">{erro}</p>}

            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={confirmar}
                disabled={status === "enviando"}
                className="btn-tactile rounded-full bg-ambar px-5 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
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
