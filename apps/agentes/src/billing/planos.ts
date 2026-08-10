// MVP (docs/06 comando 1.5): só os planos fixos "1 Agente" (design/social_media) e
// "Dupla de Agentes" (duplo) cobram assinatura por enquanto. Tráfego/Completo entram
// na Fase 2, quando o cálculo de % sobre verba de mídia estiver pronto (docs/05).
export const PLANOS_DISPONIVEIS_FASE_1 = ["design", "social_media", "duplo"] as const;
export type PlanoFase1 = (typeof PLANOS_DISPONIVEIS_FASE_1)[number];

export const VALOR_CENTAVOS_POR_PLANO: Record<PlanoFase1, number> = {
  design: 49700,
  social_media: 59700,
  duplo: 89700,
};

export function planoValidoParaAssinatura(planoId: string): planoId is PlanoFase1 {
  return (PLANOS_DISPONIVEIS_FASE_1 as readonly string[]).includes(planoId);
}
