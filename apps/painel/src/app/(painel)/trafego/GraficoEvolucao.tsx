"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PontoEvolucao {
  data: string;
  investimento: number;
}

// Substitui a antiga sparkline SVG desenhada à mão — gráfico de verdade
// (grade, eixo, tooltip com valor exato ao passar o mouse), pedido
// explícito do cliente ("gráficos, tabelas, colunas... igual o Reportei",
// esta tela vai ser apresentada pro cliente final).
export default function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  if (pontos.length < 2) return null;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gradienteInvestimento" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-menta)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-menta)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-areia)" strokeOpacity={0.08} vertical={false} />
          <XAxis dataKey="data" tick={{ fill: "var(--color-areia-2)", fontSize: 11 }} axisLine={{ stroke: "var(--color-areia)", strokeOpacity: 0.15 }} tickLine={false} />
          <YAxis
            tick={{ fill: "var(--color-areia-2)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            width={52}
          />
          <Tooltip
            contentStyle={{ background: "var(--color-petroleo-3)", border: "1px solid color-mix(in oklab, var(--color-areia) 15%, transparent)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "var(--color-areia)" }}
            formatter={(v) => [Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Investimento"]}
          />
          <Area type="monotone" dataKey="investimento" stroke="var(--color-menta)" strokeWidth={2} fill="url(#gradienteInvestimento)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
