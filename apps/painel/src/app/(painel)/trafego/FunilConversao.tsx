// Design V2 (auditoria Gravyx — módulo "Performance") — pedido explícito
// de copiar o funil de conversão visual do Gravyx (Impressões → Alcance →
// Cliques → Compras, com taxa de queda real entre cada etapa). Sem
// biblioteca de gráfico nova (nenhuma existe no painel hoje) — barra
// proporcional em CSS puro, mesmo espírito da sparkline que já existia em
// TrafegoPainel.tsx.
interface Props {
  impressoes: number;
  alcance: number;
  cliques: number;
  compras: number;
}

const FORMATADOR = new Intl.NumberFormat("pt-BR");

function taxa(atual: number, anterior: number): string {
  if (anterior <= 0) return "—";
  return `${((atual / anterior) * 100).toFixed(1)}%`;
}

export default function FunilConversao({ impressoes, alcance, cliques, compras }: Props) {
  const maior = Math.max(impressoes, 1);
  const etapas = [
    { label: "Impressões", valor: impressoes, cor: "var(--color-electric)" },
    { label: "Alcance (únicos)", valor: alcance, cor: "var(--color-menta)" },
    { label: "Cliques", valor: cliques, cor: "var(--color-ambar)" },
    { label: "Compras", valor: compras, cor: "var(--color-coral)" },
  ];

  return (
    <div className="rounded-xl border border-areia/10 bg-petroleo-2/60 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">Funil de conversão</p>
      <p className="mt-0.5 text-[11px] text-areia/40">Cada etapa do tráfego pago. Taxa entre etapas indica onde o usuário desiste.</p>
      <div className="mt-3 space-y-2">
        {etapas.map((etapa, i) => (
          <div key={etapa.label}>
            {i > 0 && (
              <p className="mb-1 pl-1 text-[10px] text-areia/30">
                ↓ {taxa(etapa.valor, etapas[i - 1].valor)} convertem <span className="text-areia/20">({etapas[i - 1].label.toLowerCase()} → {etapa.label.toLowerCase()})</span>
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-areia/70">{etapa.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-petroleo">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, (etapa.valor / maior) * 100)}%`, background: etapa.cor }} />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-xs text-areia">{FORMATADOR.format(etapa.valor)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
