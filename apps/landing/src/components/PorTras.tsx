const BLOCOS = [
  {
    titulo: "Estratégia e Inteligência",
    descricao: "Planejam o funil, estudam a concorrência e ajustam o rumo com base em dados reais — não em achismo.",
  },
  {
    titulo: "Criação",
    descricao: "Design, vídeo e social media produzindo peças dentro da identidade visual da sua marca, todos os dias.",
  },
  {
    titulo: "Aquisição de Clientes",
    descricao: "Campanhas de tráfego pago monitoradas diariamente, com trava automática de custo.",
  },
  {
    titulo: "Atendimento",
    descricao: "Um time no WhatsApp entendendo suas demandas e organizando tudo para o resto do time, 24h por dia.",
  },
];

export default function PorTras() {
  return (
    <section className="bg-areia py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold text-petroleo md:text-3xl">
          O que está por trás
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-petroleo/70">
          Um time de agentes de IA especializados, cada um com uma função clara — não é um
          chatbot genérico tentando fazer tudo.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BLOCOS.map((bloco) => (
            <div key={bloco.titulo} className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-petroleo">{bloco.titulo}</h3>
              <p className="mt-2 text-sm text-petroleo/70">{bloco.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
