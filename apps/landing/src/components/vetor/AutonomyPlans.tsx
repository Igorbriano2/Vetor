import { Reveal } from "./Reveal";
import { CtaGhost, CtaPrimary, MonoLabel, SectionHeading, SectionShell } from "./system";
import { linkWhatsapp } from "@/lib/whatsapp";

interface Plano {
  id: string;
  nome: string;
  preco: string;
  sufixo: string;
  excedente: string;
  descricao: string;
  itens: string[];
}

const PLANO_COMPLETO: Plano = {
  id: "completo",
  nome: "COMPLETO",
  preco: "R$ 1.997",
  sufixo: "/mês",
  excedente: "peça extra R$ 25 · publicação extra R$ 18 · vídeo extra R$ 150",
  descricao: "Sua agência inteira: os 7 especialistas trabalhando juntos, num só lugar.",
  itens: [
    "Design — 25 peças por mês (feed, story, anúncios, materiais)",
    "Social Media — calendário editorial completo + 30 publicações/mês",
    "Copywriter — todos os textos e legendas do plano, sem cobrança à parte",
    "Editor de Vídeo — 6 vídeos editados por mês",
    "Estrategista — revisão de posicionamento e funil todo mês",
    "Gestor de Tráfego — verba gerida até R$ 5.000/mês sem custo extra",
    "Atendente — 24h via WhatsApp, entende texto e áudio",
    "Dashboard completo + painel de solicitação e aprovação",
  ],
};

const PLANOS_ENTRADA: Plano[] = [
  {
    id: "design",
    nome: "DESIGN",
    preco: "R$ 297",
    sufixo: "/mês",
    excedente: "Excedente: R$ 30 por peça extra",
    descricao: "Peças visuais para o seu negócio, sempre dentro da sua identidade.",
    itens: [
      "Cota de 8 peças de design por mês (feed + story)",
      "Manual de marca aplicado automaticamente",
      "Aprovação das peças pelo painel antes de publicar",
    ],
  },
  {
    id: "social_media",
    nome: "SOCIAL MEDIA",
    preco: "R$ 327",
    sufixo: "/mês",
    excedente: "Excedente: R$ 22 por publicação extra",
    descricao: "Calendário editorial e legendas prontas, do jeito que sua marca fala.",
    itens: [
      "Calendário editorial mensal",
      "Cota de 12 publicações por mês",
      "Legendas no tom de voz da sua marca",
    ],
  },
  {
    id: "duplo",
    nome: "DUPLA DE AGENTES",
    preco: "R$ 547",
    sufixo: "/mês",
    excedente: "Mais barato que Design + Social separados",
    descricao: "Design + Social Media trabalhando juntos, com atendimento via WhatsApp incluso.",
    itens: [
      "Cota de 8 peças de design + 12 publicações",
      "Atendimento e organização de demandas 24h via WhatsApp",
      "Excedente de cada categoria, mesma taxa",
    ],
  },
  {
    id: "trafego",
    nome: "TRÁFEGO",
    preco: "R$ 297",
    sufixo: "/mês + 8% da verba",
    excedente: "Excedente: R$ 40 por campanha extra ativa",
    descricao: "Campanhas no Meta Ads monitoradas todos os dias, com trava automática de custo.",
    itens: [
      "Gestão de até 3 campanhas ativas simultâneas",
      "Pausa automática ao ultrapassar o teto de custo por resultado",
      "Relatório semanal de performance",
    ],
  },
];

export function AutonomyPlans() {
  return (
    <SectionShell id="planos" className="border-t border-border/60">
      <SectionHeading
        index="09"
        eyebrow="níveis de autonomia"
        title="Escolha até onde o VETOR opera sozinho."
        subtitle="Sem &ldquo;ilimitado&rdquo; vago: cada plano tem cota + excedente claro, sem precisar trocar de plano. Valores de lançamento, sujeitos a revisão após o período beta."
      />

      <Reveal>
        <div className="hover-lift animate-highlight-pulse rounded-3xl border border-primary/50 bg-primary/[0.07] p-6 shadow-glow md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="md:max-w-md">
              <MonoLabel tone="cyan">recomendado — sua agência inteira</MonoLabel>
              <h3 className="mt-3 font-mono text-sm tracking-[0.2em] text-primary">{PLANO_COMPLETO.nome}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {PLANO_COMPLETO.descricao}
              </p>
              <p className="mt-6 text-4xl font-bold text-foreground">
                {PLANO_COMPLETO.preco}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  {PLANO_COMPLETO.sufixo}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{PLANO_COMPLETO.excedente}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaPrimary href="#ativar">Quero o Completo</CtaPrimary>
                <CtaGhost
                  href={linkWhatsapp("Oi! Tenho interesse no plano Completo do Vetor.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Falar no WhatsApp
                </CtaGhost>
              </div>
            </div>
            <ul className="grid flex-1 gap-2.5 text-sm sm:grid-cols-2">
              {PLANO_COMPLETO.itens.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-0.5 text-primary" aria-hidden="true">
                    ▸
                  </span>
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Ou comece só com o que precisa agora:
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANOS_ENTRADA.map((p, i) => (
          <Reveal key={p.id} delay={i * 70}>
            <div className="panel hover-lift flex h-full flex-col rounded-2xl p-6">
              <h3 className="font-mono text-[0.7rem] tracking-[0.2em] text-primary">{p.nome}</h3>
              <p className="mt-3 text-3xl font-semibold text-foreground">
                {p.preco}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{p.sufixo}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{p.excedente}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.descricao}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                {p.itens.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-primary" aria-hidden="true">
                      ▸
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <a
                  href="#ativar"
                  className="hover-pop inline-flex h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Quero esse plano
                </a>
                <a
                  href={linkWhatsapp(`Oi! Tenho interesse no plano ${p.nome} do Vetor.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover-pop inline-flex h-11 items-center justify-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Falar no WhatsApp
                </a>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
