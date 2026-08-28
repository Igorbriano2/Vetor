"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface BarraCampanha {
  nome: string;
  investimento: number;
  ativa: boolean;
}

// Comparativo em colunas entre campanhas (pedido explícito: "gráficos,
// tabelas, colunas") — investimento por campanha, pausadas em tom apagado
// pra destacar onde a verba está de fato ativa agora.
export default function GraficoCampanhas({ campanhas }: { campanhas: BarraCampanha[] }) {
  if (campanhas.length < 2) return null;

  const dados = campanhas
    .map((c) => ({ nome: c.nome.length > 22 ? `${c.nome.slice(0, 22)}…` : c.nome, investimento: c.investimento, ativa: c.ativa }))
    .sort((a, b) => b.investimento - a.investimento)
    .slice(0, 8);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-areia)" strokeOpacity={0.08} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "var(--color-areia-2)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          />
          <YAxis type="category" dataKey="nome" tick={{ fill: "var(--color-areia-2)", fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--color-areia) 6%, transparent)" }}
            contentStyle={{ background: "var(--color-petroleo-3)", border: "1px solid color-mix(in oklab, var(--color-areia) 15%, transparent)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "var(--color-areia)" }}
            formatter={(v) => [Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Investimento"]}
          />
          <Bar dataKey="investimento" radius={[0, 6, 6, 0]}>
            {dados.map((d, i) => (
              <Cell key={i} fill={d.ativa ? "var(--color-menta)" : "color-mix(in oklab, var(--color-areia) 25%, transparent)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
