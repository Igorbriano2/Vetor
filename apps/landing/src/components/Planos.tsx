import Link from "next/link";
import { linkWhatsapp } from "@/lib/whatsapp";

interface Plano {
  id: string;
  nome: string;
  preco: string;
  excedente: string;
  descricao: string;
  inclui: string[];
}

const PLANO_COMPLETO: Plano = {
  id: "completo",
  nome: "Completo",
  preco: "R$ 1.997/mês",
  excedente: "peça extra R$ 25 · publicação extra R$ 18 · vídeo extra R$ 150",
  descricao: "Sua agência inteira: os 7 especialistas trabalhando juntos, num só lugar.",
  inclui: [
    "Design — 25 peças por mês (feed, story, anúncios, materiais)",
    "Social Media — calendário editorial completo + 30 publicações/mês",
    "Copywriter — todos os textos e legendas do plano, sem cobrança à parte",
    "Editor de Vídeo — 6 vídeos editados por mês",
    "Estrategista — revisão de posicionamento e funil todo mês",
    "Gestor de Tráfego — gestão completa, verba gerida até R$ 5.000/mês sem custo extra",
    "Atendente — 24h via WhatsApp, entende texto e áudio",
    "Dashboard completo + painel de solicitação e aprovação",
  ],
};

const PLANOS_ENTRADA: Plano[] = [
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
      "Mais barato que contratar os dois planos separados",
    ],
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

        <div className="mt-12 rounded-3xl border-2 border-menta bg-petroleo p-8 text-areia shadow-xl md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="md:max-w-md">
              <span className="inline-block rounded-full bg-ambar px-3 py-1 text-xs font-bold text-petroleo">
                RECOMENDADO — SUA AGÊNCIA INTEIRA
              </span>
              <h3 className="mt-4 text-2xl font-bold">{PLANO_COMPLETO.nome}</h3>
              <p className="mt-2 text-areia/70">{PLANO_COMPLETO.descricao}</p>
              <p className="mt-6 text-4xl font-bold text-menta">{PLANO_COMPLETO.preco}</p>
              <p className="mt-1 text-xs text-areia/50">{PLANO_COMPLETO.excedente}</p>
              <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="#lead"
                  className="rounded-full bg-ambar px-6 py-3 text-center text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
                >
                  Quero o Completo
                </Link>
                <a
                  href={linkWhatsapp("Oi! Tenho interesse no plano Completo do Vetor.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-areia/30 px-6 py-3 text-center text-sm font-medium hover:border-areia/60"
                >
                  Falar no WhatsApp
                </a>
              </div>
            </div>
            <ul className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
              {PLANO_COMPLETO.inclui.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-0.5 text-menta">✓</span>
                  <span className="text-areia/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mx-auto mt-12 max-w-xl text-center text-sm text-petroleo/60">
          Ou comece só com o que precisa agora:
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANOS_ENTRADA.map((plano) => (
            <div
              key={plano.id}
              className="flex flex-col rounded-2xl border border-petroleo/10 bg-white p-6 text-petroleo"
            >
              <h3 className="text-lg font-semibold">{plano.nome}</h3>
              <p className="mt-1 text-2xl font-bold text-petroleo">{plano.preco}</p>
              <p className="text-xs text-petroleo/50">{plano.excedente}</p>
              <p className="mt-2 text-sm text-petroleo/70">{plano.descricao}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plano.inclui.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-menta-forte">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href="#lead"
                  className="rounded-full bg-petroleo px-4 py-2 text-center text-sm font-semibold text-areia transition hover:bg-petroleo-2"
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
