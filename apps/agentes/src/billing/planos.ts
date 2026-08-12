// MVP (docs/06 comando 1.5): só os planos fixos "1 Agente" (design/social_media) e
// "Dupla de Agentes" (duplo) cobram assinatura por enquanto. Tráfego/Completo entram
// na Fase 2, quando o cálculo de % sobre verba de mídia estiver pronto (docs/05).
export const PLANOS_DISPONIVEIS_FASE_1 = ["design", "social_media", "duplo"] as const;
export type PlanoFase1 = (typeof PLANOS_DISPONIVEIS_FASE_1)[number];

// Valores base (cota inclusa) — cobranca de excedente por unidade acima da cota
// fica pra Fase 4 (docs/06, comando 4.3), ainda nao automatizada aqui.
export const VALOR_CENTAVOS_POR_PLANO: Record<PlanoFase1, number> = {
  design: 29700,
  social_media: 32700,
  duplo: 54700,
};

// Preco por unidade de excedente, exibido na landing page — usado quando a
// cobranca de excedente for automatizada (Fase 4).
export const EXCEDENTE_CENTAVOS_POR_PLANO: Record<PlanoFase1, number> = {
  design: 3000, // por peça extra
  social_media: 2200, // por publicacao extra
  duplo: 0, // usa a taxa de excedente da categoria correspondente (design/social)
};

export function planoValidoParaAssinatura(planoId: string): planoId is PlanoFase1 {
  return (PLANOS_DISPONIVEIS_FASE_1 as readonly string[]).includes(planoId);
}
