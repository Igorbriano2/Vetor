const LINHAS = [
  { criterio: "Tempo de resposta", tradicional: "Até 3 dias úteis", vetor: "Poucos segundos, 24h" },
  { criterio: "Disponibilidade", tradicional: "Horário comercial", vetor: "Todos os dias, o dia todo" },
  { criterio: "Custo mensal", tradicional: "Fração alta do faturamento", vetor: "Acessível para pequenos negócios" },
  { criterio: "Transparência de relatório", tradicional: "PDF mensal, às vezes atrasado", vetor: "Painel ao vivo, sempre atualizado" },
  { criterio: "Fidelidade", tradicional: "Contrato de 6 a 12 meses", vetor: "Sem fidelidade" },
];

export default function Comparativo() {
  return (
    <section className="bg-petroleo py-20 text-areia">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-2xl font-bold md:text-3xl">
          Agência tradicional vs. Vetor
        </h2>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-areia/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-areia/10 text-areia/60">
                <th className="px-4 py-3 font-medium">Critério</th>
                <th className="px-4 py-3 font-medium">Agência tradicional</th>
                <th className="px-4 py-3 font-medium text-menta">Vetor</th>
              </tr>
            </thead>
            <tbody>
              {LINHAS.map((linha) => (
                <tr key={linha.criterio} className="border-b border-areia/10 last:border-0">
                  <td className="px-4 py-3 font-medium">{linha.criterio}</td>
                  <td className="px-4 py-3 text-areia/70">{linha.tradicional}</td>
                  <td className="px-4 py-3 font-semibold text-menta">{linha.vetor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
