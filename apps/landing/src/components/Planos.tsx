import Link from "next/link";
import { linkWhatsapp } from "@/lib/whatsapp";

interface Plano {
  id: string;
  nome: string;
  preco: string;
  descricao: string;
  inclui: string[];
  destaque?: boolean;
}

const PLANOS: Plano[] = [
  {
    id: "design",
    nome: "Design",
    preco: "R$ 497/mês",
    descricao: "Peças visuais para o seu negócio, sempre dentro da sua identidade.",
    inclui: [
      "Até 12 peças de design por mês (feed + story)",
      "Manual de marca cadastrado e aplicado automaticamente",
      "Aprovação das peças pelo painel antes de publicar",
    ],
  },
  {
    id: "social_media",
    nome: "Social Media",
    preco: "R$ 597/mês",
    descricao: "Calendário editorial e legendas prontas, do jeito que sua marca fala.",
    inclui: [
      "Calendário editorial mensal",
      "Legendas no tom de voz da sua marca",
      "Agendamento nos canais conectados",
    ],
  },
  {
    id: "duplo",
    nome: "Dupla de Agentes",
    preco: "R$ 897/mês",
    descricao: "Design + Social Media trabalhando juntos, com atendimento via WhatsApp incluso.",
    inclui: [
      "Tudo do plano Design + Social Media",
      "Atendimento e organização de demandas 24h via WhatsApp",
      "Painel único com status de tudo",
    ],
    destaque: true,
  },
  {
    id: "trafego",
    nome: "Tráfego",
    preco: "R$ 797/mês + taxa sobre verba",
    descricao: "Campanhas no Meta Ads monitoradas todos os dias, com trava automática de custo.",
    inclui: [
      "Criação e gestão de campanhas no Meta Ads",
      "Pausa automática ao ultrapassar o teto de custo por resultado",
      "Relatório semanal de performance",
    ],
  },
];

export default function Planos() {
  return (
    <section id="planos" className="bg-areia py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold text-petroleo md:text-3xl">Planos</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-petroleo/70">
          Sem &ldquo;ilimitado&rdquo; vago. Cada plano diz exatamente o que está incluso.
          Valores de lançamento, sujeitos a revisão após o período beta.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANOS.map((plano) => (
            <div
              key={plano.id}
              className={`flex flex-col rounded-2xl border p-6 ${
                plano.destaque
                  ? "border-menta bg-petroleo text-areia shadow-lg"
                  : "border-petroleo/10 bg-white text-petroleo"
              }`}
            >
              <h3 className="text-lg font-semibold">{plano.nome}</h3>
              <p
                className={`mt-1 text-2xl font-bold ${plano.destaque ? "text-menta" : "text-petroleo"}`}
              >
                {plano.preco}
              </p>
              <p className={`mt-2 text-sm ${plano.destaque ? "text-areia/70" : "text-petroleo/70"}`}>
                {plano.descricao}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plano.inclui.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className={plano.destaque ? "text-menta" : "text-menta-forte"}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href="#lead"
                  className={`rounded-full px-4 py-2 text-center text-sm font-semibold transition ${
                    plano.destaque
                      ? "bg-menta text-petroleo hover:bg-menta-forte hover:text-white"
                      : "bg-petroleo text-areia hover:bg-petroleo-2"
                  }`}
                >
                  Quero esse plano
                </Link>
                <a
                  href={linkWhatsapp(`Oi! Tenho interesse no plano ${plano.nome} do Vetor.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-current px-4 py-2 text-center text-sm font-medium opacity-80 hover:opacity-100"
                >
                  Falar no WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
