import { Reveal } from "./Reveal";
import { SectionHeading, SectionShell } from "./system";

const LINHAS = [
  { criterio: "Tempo de resposta", tradicional: "Até 3 dias úteis", vetor: "Poucos segundos, 24h" },
  { criterio: "Disponibilidade", tradicional: "Horário comercial", vetor: "Todos os dias, o dia todo" },
  { criterio: "Custo mensal", tradicional: "Fração alta do faturamento", vetor: "Acessível para pequenos negócios" },
  { criterio: "Transparência de relatório", tradicional: "PDF mensal, às vezes atrasado", vetor: "Painel ao vivo, sempre atualizado" },
  { criterio: "Fidelidade", tradicional: "Contrato de 6 a 12 meses", vetor: "Sem fidelidade" },
];

export function Comparativo() {
  return (
    <SectionShell id="comparacao" className="border-t border-border/60">
      <SectionHeading
        index="02"
        eyebrow="agência tradicional vs. vetor"
        title="A diferença não é só o preço."
        align="center"
      />
      <Reveal className="mx-auto max-w-4xl overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 font-medium">Critério</th>
              <th className="px-4 py-3 font-medium">Agência tradicional</th>
              <th className="px-4 py-3 font-medium text-primary">Vetor</th>
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((linha) => (
              <tr key={linha.criterio} className="border-b border-border last:border-0 odd:bg-surface/40">
                <td className="px-4 py-3 font-medium text-foreground">{linha.criterio}</td>
                <td className="px-4 py-3 text-muted-foreground">{linha.tradicional}</td>
                <td className="px-4 py-3 font-semibold text-primary">{linha.vetor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </SectionShell>
  );
}
