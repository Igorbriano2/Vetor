"use client";

import { useState } from "react";

interface Nicho {
  id: string;
  nome: string;
  exemplo: string;
}

const NICHOS: Nicho[] = [
  {
    id: "restaurantes",
    nome: "Restaurantes e Delivery",
    exemplo:
      "\"Sexta-feira, 18h: o Vetor já publicou o post do rodízio e ajustou o anúncio pra quem está a menos de 5km do salão.\"",
  },
  {
    id: "advogados",
    nome: "Advogados",
    exemplo:
      "\"O Vetor escreve conteúdo institucional dentro das regras da OAB — sem apelo comercial, sem risco pro seu registro.\"",
  },
  {
    id: "arquitetos",
    nome: "Arquitetos e Engenheiros",
    exemplo:
      "\"Portfólio de obra vira post e case em minutos, com a identidade visual do seu escritório.\"",
  },
  {
    id: "saude",
    nome: "Profissionais da Saúde",
    exemplo:
      "\"Toda peça passa pela regra de compliance de saúde antes de sair — sem promessa de resultado clínico.\"",
  },
  {
    id: "estetica",
    nome: "Estética",
    exemplo:
      "\"Antes/depois só vai ao ar com sua aprovação — o Vetor sinaliza automaticamente quando precisa de OK humano.\"",
  },
];

export default function NichoSelector() {
  const [ativo, setAtivo] = useState(NICHOS[0].id);
  const nichoAtivo = NICHOS.find((n) => n.id === ativo) ?? NICHOS[0];

  return (
    <section className="bg-areia py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold text-petroleo md:text-3xl">
          Veja com os olhos do seu negócio
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-petroleo/70">
          O Vetor se adapta ao seu nicho — regras, tom de voz e prioridades mudam conforme o tipo
          de negócio.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {NICHOS.map((nicho) => (
            <button
              key={nicho.id}
              onClick={() => setAtivo(nicho.id)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                ativo === nicho.id
                  ? "bg-petroleo text-areia"
                  : "bg-white text-petroleo/70 hover:bg-petroleo/5"
              }`}
            >
              {nicho.nome}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-white p-6 text-center text-petroleo shadow-sm">
          <p className="text-lg italic">{nichoAtivo.exemplo}</p>
        </div>
      </div>
    </section>
  );
}
