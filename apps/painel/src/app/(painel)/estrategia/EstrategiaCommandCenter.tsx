"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { AreaIconBadge } from "@/components/ui/areaIcons";
import RotaEstrategicaView from "../planejamento/RotaEstrategicaView";
import type { RotaEstrategica } from "../planejamento/rotaEstrategicaTipos";
import NovaAnaliseWizard from "./NovaAnaliseWizard";
import PlanosMensais, { type PlanoMensal } from "./PlanosMensais";

interface EtapaEmAndamento {
  id: string;
  tarefa: string;
  status: string;
  missionId: string;
  missionTitulo: string;
}

interface Campanha {
  id: string;
  titulo: string;
  status: string;
  contagem: { total: number; aprovacao: number; concluidas: number };
}

interface Hipotese {
  id: string;
  titulo: string;
  hipotese: string;
  criterioSucesso: string[];
}

interface Rota {
  id: string;
  titulo: string;
  missionId: string | null;
  createdAt: string;
  rota: RotaEstrategica;
}

export default function EstrategiaCommandCenter({
  etapasEmAndamento,
  campanhas,
  hipoteses,
  rotas,
  planosMensais,
}: {
  etapasEmAndamento: EtapaEmAndamento[];
  campanhas: Campanha[];
  hipoteses: Hipotese[];
  rotas: Rota[];
  planosMensais: PlanoMensal[];
}) {
  const [wizardAberto, setWizardAberto] = useState(false);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <AreaIconBadge href="/estrategia" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
            <h1 className="text-2xl font-bold text-areia">Estratégia</h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">
          Diagnóstico, hipóteses, rotas de ação e planos mensais do negócio. Peça uma análise nova, acompanhe o que
          está em andamento ou reveja o que já foi entregue.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setWizardAberto(true)}
            className="btn-tactile rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
          >
            + Nova análise estratégica
          </button>
        </div>

        {etapasEmAndamento.length > 0 && (
          <section className="mt-10">
            <p className="mono-label mb-3 text-areia/50">Trabalhando agora</p>
            <div className="space-y-2">
              {etapasEmAndamento.map((e) => (
                <Link
                  key={e.id}
                  href={`/missoes/${e.missionId}`}
                  className="flex items-center justify-between gap-4 rounded-2xl card-lift panel p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-areia">{e.tarefa}</p>
                    <p className="mt-0.5 text-xs text-areia/40">{e.missionTitulo}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Minhas análises</p>
          {campanhas.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campanhas.map((c) => (
                <Link
                  key={c.id}
                  href={`/missoes/${c.id}`}
                  className="rounded-2xl card-lift panel p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-areia">{c.titulo}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-2 text-xs text-areia/40">
                    {c.contagem.total} {c.contagem.total === 1 ? "etapa" : "etapas"}
                    {c.contagem.aprovacao > 0 && ` · ${c.contagem.aprovacao} aguardando aprovação`}
                    {c.contagem.concluidas > 0 && ` · ${c.contagem.concluidas} concluída${c.contagem.concluidas === 1 ? "" : "s"}`}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">
              Nenhuma análise estratégica ainda — peça uma nova acima.
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Hipóteses em jogo</p>
          {hipoteses.length > 0 ? (
            <div className="space-y-3">
              {hipoteses.map((h) => (
                <Link
                  key={h.id}
                  href={`/missoes/${h.id}`}
                  className="block rounded-2xl card-lift panel p-4"
                >
                  <p className="font-medium text-areia">{h.titulo}</p>
                  <p className="mt-1 text-sm text-areia/70">
                    <span className="text-areia/50">Hipótese:</span> {h.hipotese}
                  </p>
                  {h.criterioSucesso.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-areia/50">
                      {h.criterioSucesso.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">
              Nenhuma missão com hipótese registrada ainda.
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Rotas estratégicas entregues</p>
          {rotas.length > 0 ? (
            <div className="space-y-10">
              {rotas.map((r) => (
                <div key={r.id}>
                  <RotaEstrategicaView rota={r.rota} />
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-areia/30">
                    <span>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                    {r.missionId && (
                      <Link href={`/missoes/${r.missionId}`} className="text-menta hover:underline">
                        ver missão
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">
              Nenhuma rota estratégica entregue ainda — peça uma análise com uma rota de ação acima.
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Planos mensais</p>
          <PlanosMensais planos={planosMensais} />
        </section>
      </div>

      {wizardAberto && <NovaAnaliseWizard onFechar={() => setWizardAberto(false)} />}
    </div>
  );
}
