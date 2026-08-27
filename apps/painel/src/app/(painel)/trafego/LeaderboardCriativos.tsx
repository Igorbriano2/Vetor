"use client";

import { useState } from "react";

export interface Criativo {
  id: string;
  nome: string;
  thumbnailUrl: string | null;
  spend: number;
  clicks: number;
  compras: number;
  cpc: number | null;
  ctr: number | null;
}

// Design V2 (auditoria Gravyx — módulo "Performance") — pedido explícito de
// copiar o ranking "Top 5 criativos por métrica" do Gravyx. Alimentado por
// criativos_trafego (migration 0039) — nível de anúncio real, sincronizado
// por sincronizarCriativosDaCampanha() em metaAdsSync.ts. CPC menor é
// melhor (ordena crescente); CTR/Compras maior é melhor (ordena
// decrescente) — mesma lógica do Gravyx.
type Metrica = "cpc" | "ctr" | "compras";

const METRICAS: Array<{ valor: Metrica; label: string; menorEhMelhor: boolean }> = [
  { valor: "cpc", label: "CPC", menorEhMelhor: true },
  { valor: "ctr", label: "CTR", menorEhMelhor: false },
  { valor: "compras", label: "Compras", menorEhMelhor: false },
];

function formatarMetrica(criativo: Criativo, metrica: Metrica): string {
  if (metrica === "cpc") return criativo.cpc != null ? `R$ ${criativo.cpc.toFixed(2)}` : "—";
  if (metrica === "ctr") return criativo.ctr != null ? `${criativo.ctr.toFixed(2)}%` : "—";
  return String(criativo.compras);
}

export default function LeaderboardCriativos({ criativos }: { criativos: Criativo[] }) {
  const [metrica, setMetrica] = useState<Metrica>("cpc");
  const config = METRICAS.find((m) => m.valor === metrica)!;

  const ranqueados = [...criativos]
    .filter((c) => (metrica === "cpc" ? c.cpc != null : metrica === "ctr" ? c.ctr != null : true))
    .sort((a, b) => {
      const va = metrica === "cpc" ? (a.cpc ?? 0) : metrica === "ctr" ? (a.ctr ?? 0) : a.compras;
      const vb = metrica === "cpc" ? (b.cpc ?? 0) : metrica === "ctr" ? (b.ctr ?? 0) : b.compras;
      return config.menorEhMelhor ? va - vb : vb - va;
    })
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">Top 5 criativos por</p>
        <div className="flex gap-1">
          {METRICAS.map((m) => (
            <button
              key={m.valor}
              onClick={() => setMetrica(m.valor)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${metrica === m.valor ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/50 hover:border-menta/30"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-[10px] text-areia/30">{config.menorEhMelhor ? "menor é melhor" : "maior é melhor"}</p>

      {ranqueados.length === 0 ? (
        <p className="mt-3 rounded-xl border border-areia/10 bg-petroleo-2/40 p-3 text-xs text-areia/40">Nenhum criativo com essa métrica sincronizado ainda.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ranqueados.map((c, i) => (
            <div key={c.id} className="overflow-hidden rounded-xl panel">
              <div className="flex items-center justify-between px-2 pt-2">
                <span className="flex size-5 items-center justify-center btn-tactile rounded-full bg-ambar/15 text-[10px] font-semibold text-ambar">{i + 1}</span>
              </div>
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-petroleo/60">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnailUrl} alt={c.nome} className="size-full object-cover" />
                ) : (
                  <span className="text-[10px] text-areia/25">sem thumbnail</span>
                )}
              </div>
              <div className="space-y-0.5 p-2">
                <p className="truncate text-[11px] font-medium text-areia" title={c.nome}>
                  {c.nome}
                </p>
                <p className="font-mono text-xs text-menta">{formatarMetrica(c, metrica)}</p>
                <p className="text-[10px] text-areia/40">
                  Gasto R$ {c.spend.toFixed(0)} · {c.clicks} cliques
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
