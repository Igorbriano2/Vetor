import { Reveal } from "./Reveal";
import { MonoLabel, SectionShell } from "./system";

const JANELAS = [
  "GERENCIADOR DE ANÚNCIOS",
  "PLANILHA DE RESULTADOS",
  "CALENDÁRIO EDITORIAL",
  "CAIXA DE MENSAGENS",
  "RELATÓRIO PDF",
  "BRIEFING NO E-MAIL",
];

export function Fragmentacao() {
  return (
    <SectionShell id="tensao" className="border-t border-border/60">
      <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <MonoLabel tone="cyan">01 // o modelo antigo</MonoLabel>
          <h2 className="mt-4 text-[1.75rem] leading-[1.12] font-semibold text-balance sm:text-4xl">
            O marketing virou um amontoado de ferramentas.
            <span className="block text-muted-foreground">Crescimento exige um sistema.</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Cada pedaço do seu marketing mora em um lugar diferente, com pessoas diferentes e
            prazos diferentes. Nada disso conversa. O que se perde no caminho é a decisão.
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground">
            O VETOR substitui a fragmentação por uma camada única de inteligência, execução e
            aprendizado. Um contexto só, atualizado o tempo todo.
          </p>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {JANELAS.map((j, i) => (
              <Reveal key={j} delay={i * 70}>
                <div className="h-24 rounded-xl border border-border/70 bg-surface/60 p-3 opacity-60 transition-opacity hover:opacity-100">
                  <div className="flex gap-1" aria-hidden="true">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                  </div>
                  <p className="mono-label mt-3 text-[0.55rem] leading-relaxed">{j}</p>
                  <div className="mt-2 space-y-1" aria-hidden="true">
                    <span className="block h-1 w-4/5 rounded bg-border" />
                    <span className="block h-1 w-2/3 rounded bg-border" />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="panel mt-4 flex items-center gap-4 rounded-2xl p-4">
              <svg viewBox="0 0 60 40" className="h-10 w-14 shrink-0" aria-hidden="true">
                <g stroke="var(--cyan)" strokeOpacity="0.5" fill="none">
                  <path d="M2 4C24 4 30 20 58 20" />
                  <path d="M2 20h56" />
                  <path d="M2 36C24 36 30 20 58 20" />
                </g>
                <circle cx="58" cy="20" r="4" fill="var(--cyan)" />
              </svg>
              <p className="text-sm leading-relaxed">
                <span className="font-mono text-[0.65rem] tracking-[0.18em] text-primary">
                  CONVERGÊNCIA
                </span>
                <span className="mt-1 block text-muted-foreground">
                  Todas as fontes viram sinal. Todo sinal vira decisão dentro do VETOR.
                </span>
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </SectionShell>
  );
}
