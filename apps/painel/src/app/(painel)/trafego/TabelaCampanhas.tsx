"use client";

import StatusBadge from "@/components/StatusBadge";

interface LinhaCampanha {
  id: string;
  nome: string;
  status: string;
  investimento: string;
  impressoes: string;
  cliques: string;
  ctr: string;
  cpc: string;
  compras: string;
  roas: string;
}

const COLUNAS: Array<{ chave: keyof LinhaCampanha; label: string; alinhamento?: "right" }> = [
  { chave: "nome", label: "Campanha" },
  { chave: "investimento", label: "Investimento", alinhamento: "right" },
  { chave: "impressoes", label: "Impressões", alinhamento: "right" },
  { chave: "cliques", label: "Cliques", alinhamento: "right" },
  { chave: "ctr", label: "CTR", alinhamento: "right" },
  { chave: "cpc", label: "CPC", alinhamento: "right" },
  { chave: "compras", label: "Compras", alinhamento: "right" },
  { chave: "roas", label: "ROAS", alinhamento: "right" },
];

// Tabela real (linhas/colunas) em vez do accordion anterior — pedido
// explícito ("tabelas, colunas... igual o Reportei"). overflow-x-auto no
// próprio container pra rolar só a tabela em telas estreitas, nunca a
// página inteira.
export default function TabelaCampanhas({ linhas }: { linhas: LinhaCampanha[] }) {
  if (linhas.length === 0) {
    return <p className="rounded-2xl panel p-4 text-sm text-areia/40">Nenhuma campanha registrada ainda.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl panel">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-areia/10">
            {COLUNAS.map((col) => (
              <th key={col.chave} className={`px-4 py-3 font-mono text-[10px] uppercase tracking-wide text-areia/40 ${col.alinhamento === "right" ? "text-right" : "text-left"}`}>
                {col.label}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wide text-areia/40">Status</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b border-areia/5 transition-colors last:border-0 hover:bg-areia/[0.03]">
              <td className="max-w-[220px] truncate px-4 py-3 font-medium text-areia">{l.nome}</td>
              <td className="px-4 py-3 text-right tabular-nums text-areia/80">{l.investimento}</td>
              <td className="px-4 py-3 text-right tabular-nums text-areia/60">{l.impressoes}</td>
              <td className="px-4 py-3 text-right tabular-nums text-areia/60">{l.cliques}</td>
              <td className="px-4 py-3 text-right tabular-nums text-areia/60">{l.ctr}</td>
              <td className="px-4 py-3 text-right tabular-nums text-areia/60">{l.cpc}</td>
              <td className="px-4 py-3 text-right tabular-nums text-areia/60">{l.compras}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium text-menta">{l.roas}</td>
              <td className="px-4 py-3 text-right">
                <StatusBadge status={l.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
