const ETAPAS = [
  {
    quando: "Segunda, 09h",
    titulo: "O pedido chega pelo WhatsApp",
    descricao: '"Preciso de 5 posts para o feed desta semana" — o cliente manda a demanda direto pro Vetor.',
  },
  {
    quando: "Segunda, 09h02",
    titulo: "O time se organiza sozinho",
    descricao: "O Agente Secretário estrutura o pedido e o Agente Geral distribui para Design e Social Media.",
  },
  {
    quando: "Terça, 14h",
    titulo: "As peças ficam prontas para aprovação",
    descricao: "Tudo aparece no painel do cliente, pronto para revisar e aprovar em poucos cliques.",
  },
  {
    quando: "Quarta",
    titulo: "O tráfego se ajusta sozinho",
    descricao: "O Agente de Tráfego pausa ou ajusta uma campanha porque o custo por resultado subiu — sem esperar ninguém perceber.",
  },
  {
    quando: "Sexta",
    titulo: "O relatório chega sozinho",
    descricao: "Métricas da semana e sugestões do Agente Analítico caem no painel — e no WhatsApp, se preferir.",
  },
];

export default function Jornada() {
  return (
    <section className="bg-petroleo py-20 text-areia">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-2xl font-bold md:text-3xl">
          Uma semana de trabalho da sua agência
        </h2>
        <div className="mt-12 space-y-8 border-l border-areia/20 pl-8">
          {ETAPAS.map((etapa) => (
            <div key={etapa.titulo} className="relative">
              <div className="absolute -left-[2.35rem] top-1 h-3 w-3 rounded-full bg-menta" />
              <p className="text-sm font-semibold uppercase tracking-wide text-menta">
                {etapa.quando}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{etapa.titulo}</h3>
              <p className="mt-1 text-areia/70">{etapa.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
