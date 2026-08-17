"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";
import { SectionHeading, SectionShell } from "./system";

const PERGUNTAS = [
  {
    pergunta: "Como funciona a IA — ela erra?",
    resposta:
      "Sim, como qualquer time — a diferença é que toda peça e campanha passa por critérios de aceite antes de chegar até você, e você aprova antes de qualquer coisa ir ao ar.",
  },
  {
    pergunta: "Preciso trocar de número de WhatsApp?",
    resposta:
      "Não necessariamente. Conectamos o VETOR ao número que você já usa com seus clientes, usando a API oficial do WhatsApp Business.",
  },
  {
    pergunta: "Quanto tempo leva para configurar?",
    resposta:
      "O setup inicial (cadastro da marca, plano e conexão do WhatsApp) leva minutos. O time de agentes começa a atuar assim que os dados básicos do seu negócio estão cadastrados.",
  },
  {
    pergunta: "Funciona para o meu tipo de negócio?",
    resposta:
      "O VETOR foi desenhado para restaurantes e delivery, advogados, arquitetos e engenheiros, profissionais da saúde e estética. Se o seu negócio é outro, fale com a gente pelo WhatsApp.",
  },
  {
    pergunta: "E se eu quiser falar com uma pessoa de verdade?",
    resposta:
      "É só pedir, a qualquer momento — o agente Atendente transfere a conversa para um humano da equipe com todo o histórico anexado.",
  },
  {
    pergunta: "Meus dados estão seguros?",
    resposta:
      "Sim. Seguimos a LGPD: seus dados ficam isolados dos de outros clientes, com direito a exportação e exclusão a qualquer momento.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta: "Pode. Não trabalhamos com fidelidade nem contrato engessado.",
  },
];

export function Faq() {
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <SectionShell id="faq" className="border-t border-border/60">
      <SectionHeading index="10" eyebrow="perguntas frequentes" title="O que você precisa saber antes de ativar." align="center" />

      <Reveal className="panel mx-auto max-w-3xl divide-y divide-border rounded-2xl">
        {PERGUNTAS.map((item, i) => (
          <div key={item.pergunta} className="px-5">
            <button
              type="button"
              onClick={() => setAberto(aberto === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-base"
              aria-expanded={aberto === i}
            >
              {item.pergunta}
              <span className="mono-label shrink-0 text-primary">{aberto === i ? "−" : "+"}</span>
            </button>
            {aberto === i && (
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.resposta}</p>
            )}
          </div>
        ))}
      </Reveal>
    </SectionShell>
  );
}
