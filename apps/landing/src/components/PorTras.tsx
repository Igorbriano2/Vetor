const EQUIPE = [
  { papel: "Designer", descricao: "Cria as peças visuais dentro da identidade da sua marca — feed, story, anúncio, material impresso." },
  { papel: "Estrategista", descricao: "Planeja o funil, estuda a concorrência e define o rumo da campanha com base em dados, não em achismo." },
  { papel: "Social Media", descricao: "Monta o calendário editorial e escreve as legendas no tom de voz da sua marca." },
  { papel: "Editor de Vídeo", descricao: "Corta, legenda e formata vídeos pra reels, stories e anúncios." },
  { papel: "Copywriter", descricao: "Escreve os textos — legendas, anúncios, respostas — sem parecer robótico." },
  { papel: "Gestor de Tráfego", descricao: "Cria e ajusta campanhas no Meta Ads, com trava automática de custo." },
  { papel: "Atendente", descricao: "Organiza suas demandas pelo WhatsApp 24h por dia, entende texto e áudio." },
];

export default function PorTras() {
  return (
    <section className="bg-areia py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold text-petroleo md:text-3xl">
          O que está por trás
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-petroleo/70">
          Uma agência de marketing de verdade tem 7 especialistas. No Vetor, os 7 são agentes de
          IA — cada um com uma função clara, não um chatbot genérico tentando fazer tudo.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {EQUIPE.map((pessoa) => (
            <div key={pessoa.papel} className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-petroleo">{pessoa.papel}</h3>
              <p className="mt-2 text-sm text-petroleo/70">{pessoa.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
