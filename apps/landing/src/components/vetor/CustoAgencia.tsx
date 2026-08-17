import { Reveal } from "./Reveal";
import { MonoLabel, SectionHeading, SectionShell } from "./system";

const EQUIPE = [
  { papel: "Designer", custo: 1800 },
  { papel: "Estrategista de marketing", custo: 2000 },
  { papel: "Social Media", custo: 1500 },
  { papel: "Editor de vídeo", custo: 1500 },
  { papel: "Copywriter / Redator", custo: 1200 },
  { papel: "Gestor de tráfego (fee de gestão)", custo: 1800 },
  { papel: "Atendente", custo: 2200 },
  { papel: "Ferramentas (design, agendamento, CRM, dashboard)", custo: 400 },
];

const TOTAL_EQUIPE = EQUIPE.reduce((soma, item) => soma + item.custo, 0);
const PRECO_VETOR = 1997;
const ECONOMIA = TOTAL_EQUIPE - PRECO_VETOR;
const ECONOMIA_PERCENTUAL = Math.round((ECONOMIA / TOTAL_EQUIPE) * 100);

function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function CustoAgencia() {
  return (
    <SectionShell id="custo" className="border-t border-border/60">
      <SectionHeading
        index="08"
        eyebrow="o custo real"
        title="Quanto custa montar essa equipe sozinho."
        subtitle="Uma agência de marketing de verdade tem 7 especialistas por trás. No VETOR, os 7 são agentes de IA — sem contratar, treinar ou gerenciar ninguém. Valores abaixo são médias de mercado para contratação parcial no Brasil, não um preço fechado."
      />

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <Reveal className="panel rounded-2xl p-6">
          <MonoLabel tone="cyan">montando a equipe por conta própria</MonoLabel>
          <ul className="mt-4 space-y-2 text-sm">
            {EQUIPE.map((item) => (
              <li
                key={item.papel}
                className="flex items-center justify-between border-b border-border/70 py-2 last:border-0"
              >
                <span className="text-muted-foreground">{item.papel}</span>
                <span className="font-mono text-foreground">{formatarReais(item.custo)}/mês</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="font-semibold text-foreground">Total estimado</span>
            <span className="text-xl font-bold text-foreground">{formatarReais(TOTAL_EQUIPE)}/mês</span>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="hover-lift flex h-full flex-col justify-between rounded-2xl border border-primary/40 bg-primary/[0.06] p-6 shadow-glow">
            <div>
              <MonoLabel tone="cyan">com o vetor completo</MonoLabel>
              <p className="mt-4 text-4xl font-bold text-foreground">
                {formatarReais(PRECO_VETOR)}
                <span className="text-base font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Os 7 especialistas, o painel de solicitação e o dashboard, tudo em uma ferramenta só.
              </p>
            </div>
            <div className="mt-6 rounded-xl border border-amber/30 bg-amber/[0.08] p-4">
              <p className="text-sm text-muted-foreground">Você economiza</p>
              <p className="text-2xl font-bold text-amber">
                {formatarReais(ECONOMIA)}/mês{" "}
                <span className="text-base font-normal">({ECONOMIA_PERCENTUAL}%)</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sem contar tempo de contratação, treinamento, turnover, férias e 13º de uma equipe própria.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground/70">
        A verba investida em anúncios (Meta/Google) é sempre paga direto à plataforma de anúncios,
        em qualquer cenário — isso não entra nesta comparação de custo de operação.
      </p>
    </SectionShell>
  );
}
