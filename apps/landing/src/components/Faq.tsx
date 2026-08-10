"use client";

import { useState } from "react";

const PERGUNTAS = [
  {
    pergunta: "Como funciona a IA — ela erra?",
    resposta:
      "Sim, como qualquer time — a diferença é que toda peça e campanha passa por critérios de aceite antes de chegar até você, e você aprova antes de qualquer coisa ir ao ar.",
  },
  {
    pergunta: "Preciso trocar de número de WhatsApp?",
    resposta:
      "Não necessariamente. Conectamos o Vetor ao número que você já usa com seus clientes, usando a API oficial do WhatsApp Business.",
  },
  {
    pergunta: "Quanto tempo leva para configurar?",
    resposta:
      "O setup inicial (cadastro da marca, plano e conexão do WhatsApp) leva minutos. O time de agentes começa a atuar assim que os dados básicos do seu negócio estão cadastrados.",
  },
  {
    pergunta: "Funciona para o meu tipo de negócio?",
    resposta:
      "O Vetor foi desenhado para restaurantes e delivery, advogados, arquitetos e engenheiros, profissionais da saúde e estética. Se o seu negócio é outro, fale com a gente pelo WhatsApp.",
  },
  {
    pergunta: "E se eu quiser falar com uma pessoa de verdade?",
    resposta:
      "É só pedir, a qualquer momento — o Agente Secretário transfere a conversa para um humano da equipe com todo o histórico anexado.",
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

export default function Faq() {
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <section className="bg-petroleo py-20 text-areia">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-center text-2xl font-bold md:text-3xl">Perguntas frequentes</h2>
        <div className="mt-10 divide-y divide-areia/10 rounded-2xl border border-areia/10">
          {PERGUNTAS.map((item, i) => (
            <div key={item.pergunta} className="px-5">
              <button
                onClick={() => setAberto(aberto === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium"
                aria-expanded={aberto === i}
              >
                {item.pergunta}
                <span className="text-menta">{aberto === i ? "−" : "+"}</span>
              </button>
              {aberto === i && <p className="pb-4 text-areia/70">{item.resposta}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
