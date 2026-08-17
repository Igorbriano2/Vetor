import { Reveal } from "./Reveal";
import { SectionHeading, SectionShell } from "./system";

const ETAPAS = [
  { en: "LISTEN", pt: "Ouvir", desc: "Sinais do mercado, da concorrência e do seu próprio funil." },
  { en: "UNDERSTAND", pt: "Entender", desc: "O objetivo vira contexto: público, oferta, restrição e prazo." },
  { en: "PLAN", pt: "Planejar", desc: "Hipótese, orçamento, agentes envolvidos e limites de decisão." },
  { en: "EXECUTE", pt: "Executar", desc: "Peças, campanhas e respostas saem no ritmo da missão." },
  { en: "MEASURE", pt: "Medir", desc: "Resultado por hipótese, não por vaidade de métrica." },
  { en: "LEARN", pt: "Aprender", desc: "O que funcionou entra no contexto da próxima missão." },
];

export function CicloInteligencia() {
  return (
    <SectionShell id="ciclo" className="border-t border-border/60">
      <SectionHeading
        index="05"
        eyebrow="ciclo de inteligência"
        title="O VETOR transforma sinais em decisões, decisões em ações e ações em aprendizado."
        subtitle="O ciclo não termina na entrega: ele volta ao objetivo com mais contexto do que na rodada anterior."
      />

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ETAPAS.map((e, i) => (
          <Reveal as="li" key={e.en} delay={i * 80}>
            <div className="panel hover-lift relative h-full rounded-2xl p-5">
              <span className="font-mono text-[0.65rem] tracking-[0.2em] text-primary">
                {String(i + 1).padStart(2, "0")} · {e.en}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{e.pt}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{e.desc}</p>
            </div>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={120}>
        <p className="mono-label mt-6 block text-center">
          loop contínuo · cada missão devolve contexto ao núcleo
        </p>
      </Reveal>
    </SectionShell>
  );
}
