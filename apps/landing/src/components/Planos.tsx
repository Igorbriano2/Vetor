import Link from "next/link";
import { linkWhatsapp } from "@/lib/whatsapp";

interface Plano {
  id: string;
  nome: string;
  preco: string;
  excedente: string;
  descricao: string;
  inclui: string[];
  destaque?: boolean;
}

const PLANOS: Plano[] = [
  {
    id: "design",
    nome: "Design",
    preco: "R$ 297/mês",
    excedente: "+ R$ 30 por peça extra",
    descricao: "Peças visuais para o seu negócio, sempre dentro da sua identidade.",
    inclui: [
      "Cota de 8 peças de design por mês (feed + story)",
      "Manual de marca cadastrado e aplicado automaticamente",
      "Aprovação das peças pelo painel antes de publicar",
      "Passou da cota? Só a peça extra é cobrada, sem trocar de plano",
    ],
  },
  {
    id: "social_media",
    nome: "Social Media",
    preco: "R$ 327/mês",
    excedente: "+ R$ 22 por publicação extra",
    descricao: "Calendário editorial e legendas prontas, do jeito que sua marca fala.",
    inclui: [
      "Calendário editorial mensal",
      "Cota de 12 publicações por mês",
      "Legendas no tom de voz da sua marca",
      "Agendamento nos canais conectados",
    ],
  },
  {
    id: "duplo",
    nome: "Dupla de Agentes",
    preco: "R$ 547/mês",
    excedente: "excedente de cada categoria, mesma taxa",
    descricao: "Design + Social Media trabalhando juntos, com atendimento via WhatsApp incluso.",
    inclui: [
      "Cota de 8 peças de design + 12 publicações",
      "Atendimento e organização de demandas 24h via WhatsApp",
      "Painel único com status de tudo",
      "Mais barato que contratar os dois planos separados",
    ],
    destaque: true,
  },
  {
    id: "trafego",
    nome: "Tráfego",
    preco: "R$ 297/mês + 8% da verba",
    excedente: "+ R$ 40 por campanha extra ativa",
    descricao: "Campanhas no Meta Ads monitoradas todos os dias, com trava automática de custo.",
    inclui: [
      "Gestão de até 3 campanhas ativas simultâneas",
      "Pausa automática ao ultrapassar o teto de custo por resultado",
      "Relatório semanal de performance",
    ],
  },
  {
    id: "completo",
    nome: "Completo",
    preco: "R$ 897/mês + 8% da verba",
    excedente: "excedente de cada categoria, mesma taxa",
    descricao: "Todos os agentes trabalhando juntos: design, social media, tráfego, estratégia e relatórios.",
    inclui: [
      "Cota de 15 peças de design + 20 publicações",
      "Gestão de até 5 campanhas de tráfego ativas",
      "Revisão de estratégia trimestral + relatórios semanais do Agente Analítico",
      "Atendimento 24h via WhatsApp incluso",
    ],
  },
];

export default function Planos() {
  return (
    <section id="planos" className="bg-areia py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold text-petroleo md:text-3xl">Planos</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-petroleo/70">
          Sem &ldquo;ilimitado&rdquo; vago. Cada plano tem uma cota de uso incluída — se passar
          dela, você paga só o excedente, sem precisar trocar de plano. Valores de lançamento,
          sujeitos a revisão após o período beta.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              <p className={`text-xs ${plano.destaque ? "text-areia/50" : "text-petroleo/50"}`}>
                {plano.excedente}
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
