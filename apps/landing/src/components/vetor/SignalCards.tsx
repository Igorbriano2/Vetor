import { Reveal } from "./Reveal";
import { SectionHeading, SectionShell } from "./system";

const SINAIS = [
  { en: "CAMPAIGN EFFICIENCY", pt: "Custo por resultado por hipótese testada." },
  { en: "CONTENT VELOCITY", pt: "Ritmo de produção e publicação por semana." },
  { en: "LEAD RESPONSE TIME", pt: "Tempo entre o contato e a primeira resposta útil." },
  { en: "FUNNEL HEALTH", pt: "Onde a jornada trava antes de virar venda." },
  { en: "NEXT BEST ACTION", pt: "A decisão que o sistema recomenda agora." },
];

export function SignalCards() {
  return (
    <SectionShell id="sinais" className="border-t border-border/60">
      <SectionHeading
        index="07"
        eyebrow="resultados como sinais"
        title="Sem promessa de multiplicar vendas. Com sinais que você acompanha."
        subtitle="O VETOR trabalha com dados, hipóteses, testes e decisões. O que aparece no painel é o que o sistema realmente monitora."
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SINAIS.map((s, i) => (
          <Reveal as="li" key={s.en} delay={i * 70}>
            <div className="panel hover-lift h-full rounded-2xl p-5">
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-primary">{s.en}</span>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.pt}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </SectionShell>
  );
}
