"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import CalendarioEditorial from "@/components/CalendarioEditorial";
import MiniMarkdown from "@/components/MiniMarkdown";
import NovoConteudoWizard from "./NovoConteudoWizard";

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

interface Copy {
  id: string;
  title: string;
  content: string | null;
  missionId: string | null;
  missionTitulo: string | null;
  createdAt: string;
}

export default function SocialCommandCenter({
  clienteId,
  etapasEmAndamento,
  campanhas,
  copies,
}: {
  clienteId: string;
  etapasEmAndamento: EtapaEmAndamento[];
  campanhas: Campanha[];
  copies: Copy[];
}) {
  const [wizardAberto, setWizardAberto] = useState(false);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Social</h1>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">
          Conteúdo para redes sociais: peça um post novo, acompanhe o que está em andamento e reveja as legendas já
          entregues. O calendário editorial abaixo mostra o que está agendado.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setWizardAberto(true)}
            className="btn-tactile rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
          >
            + Novo conteúdo
          </button>
          <Link
            href="/estrategia"
            className="rounded-full border border-areia/15 px-5 py-2.5 text-sm text-areia/80 transition hover:border-menta/40 hover:text-menta"
          >
            Ver planejamento
          </Link>
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
          <p className="mono-label mb-3 text-areia/50">Minhas campanhas de conteúdo</p>
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
              Nenhuma campanha de conteúdo ainda — peça um post novo acima.
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Legendas entregues</p>
          {copies.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {copies.map((c) => (
                <div key={c.id} className="rounded-2xl panel p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-areia">{c.title}</p>
                    {c.missionId && (
                      <Link href={`/missoes/${c.missionId}`} className="shrink-0 text-xs text-menta hover:underline">
                        ver missão
                      </Link>
                    )}
                  </div>
                  {c.content && (
                    <div className="mt-2 max-h-64 overflow-y-auto text-xs text-areia/70">
                      <MiniMarkdown texto={c.content} />
                    </div>
                  )}
                  <p className="mt-2 font-mono text-[10px] text-areia/30">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">
              Nenhuma legenda entregue ainda — peça um post novo acima.
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Calendário editorial</p>
          <CalendarioEditorial clienteId={clienteId} />
        </section>
      </div>

      {wizardAberto && <NovoConteudoWizard onFechar={() => setWizardAberto(false)} />}
    </div>
  );
}
