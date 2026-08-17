"use client";

import { useState } from "react";
import { MonoLabel, SectionHeading, SectionShell } from "./system";

const VERTICAIS = [
  {
    id: "restaurantes",
    nome: "RESTAURANTES E DELIVERY",
    objetivo: "Aumentar pedidos de delivery",
    sinal: "Queda de demanda em dias de semana",
    missao: "Campanha de conversão para terça a quinta",
    agentes: "Estrategista / Copywriter / Design / Gestor de Tráfego",
  },
  {
    id: "advogados",
    nome: "ADVOGADOS",
    objetivo: "Mais consultas qualificadas",
    sinal: "Volume alto de contatos fora da área de atuação",
    missao: "Conteúdo de autoridade + triagem no primeiro contato",
    agentes: "Estrategista / Copywriter / Social Media / Atendente",
  },
  {
    id: "arquitetos",
    nome: "ARQUITETOS E ENGENHEIROS",
    objetivo: "Orçamentos com fit de projeto",
    sinal: "Portfólio com baixo alcance na região",
    missao: "Vitrine de projetos + qualificação por metragem e prazo",
    agentes: "Estrategista / Design / Editor de Vídeo / Gestor de Tráfego",
  },
  {
    id: "saude",
    nome: "PROFISSIONAIS DA SAÚDE",
    objetivo: "Preencher horários ociosos",
    sinal: "Buracos recorrentes na agenda da manhã",
    missao: "Ativação local para janelas específicas",
    agentes: "Copywriter / Gestor de Tráfego / Atendente",
  },
  {
    id: "estetica",
    nome: "ESTÉTICA",
    objetivo: "Ocupar a agenda disponível",
    sinal: "Capacidade não utilizada nos próximos 14 dias",
    missao: "Fluxo de ativação de demanda local",
    agentes: "Copywriter / Social Media / Atendente",
  },
];

export function VerticalSelector() {
  const [ativo, setAtivo] = useState(VERTICAIS[0]!.id);
  const atual = VERTICAIS.find((v) => v.id === ativo)!;

  return (
    <SectionShell id="verticais" className="border-t border-border/60">
      <SectionHeading
        index="06"
        eyebrow="demonstração por vertical"
        title="Escolha o seu tipo de negócio e veja a missão que o VETOR montaria."
      />

      <div role="tablist" aria-label="Tipo de negócio" className="flex flex-wrap gap-2">
        {VERTICAIS.map((v) => {
          const on = v.id === ativo;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setAtivo(v.id)}
              className={`hover-pop rounded-full border px-4 py-2 font-mono text-[0.65rem] tracking-[0.16em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-surface/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.nome}
            </button>
          );
        })}
      </div>

      <div key={atual.id} className="panel animate-pop-in mt-6 rounded-2xl p-5 sm:p-7">
        <MonoLabel tone="cyan">mission preview // {atual.id}</MonoLabel>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          {[
            ["OBJETIVO", atual.objetivo],
            ["SINAL DETECTADO", atual.sinal],
            ["MISSÃO", atual.missao],
            ["AGENTES ACIONADOS", atual.agentes],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="mono-label">{k}</dt>
              <dd className="mt-1.5 text-base leading-relaxed text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionShell>
  );
}
