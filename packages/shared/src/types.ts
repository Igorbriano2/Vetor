// Tipos alinhados ao schema em supabase/migrations — ver docs/04, seção 3.

export type Nicho =
  | "restaurante_delivery"
  | "advocacia"
  | "arquitetura_engenharia"
  | "saude"
  | "estetica"
  | "outro";

export type PlanoId = "design" | "social_media" | "duplo" | "trafego" | "completo";

export type StatusAssinatura = "ativa" | "atrasada" | "cancelada" | "em_teste";

export type UrgenciaDemanda = "baixa" | "media" | "alta";

export type StatusDemanda = "novo" | "em_andamento" | "aguardando_aprovacao" | "concluida" | "cancelada";

export type StatusEntrega = "rascunho" | "pendente_aprovacao" | "aprovada" | "rejeitada" | "publicada";

export interface Cliente {
  id: string;
  nome_empresa: string;
  nicho: Nicho;
  plano_id: PlanoId | null;
  status_assinatura: StatusAssinatura;
  manual_marca: Record<string, unknown> | null;
  created_at: string;
}

export interface Demanda {
  id: string;
  cliente_id: string;
  tipo_demanda: string;
  descricao: string;
  urgencia: UrgenciaDemanda;
  status: StatusDemanda;
  contexto_anterior: string | null;
  created_at: string;
}

export interface Entrega {
  id: string;
  demanda_id: string;
  tipo: string;
  status: StatusEntrega;
  arquivo_url: string | null;
  created_at: string;
}

export interface Assinatura {
  id: string;
  cliente_id: string;
  plano_id: PlanoId;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  status: StatusAssinatura;
  valor_mensal_centavos: number;
  updated_at: string;
}

export interface LogAgente {
  id: string;
  agente: string;
  cliente_id: string | null;
  demanda_id: string | null;
  acao: string;
  justificativa: string;
  created_at: string;
}
