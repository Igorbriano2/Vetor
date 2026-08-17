import { supabase } from "../db/supabase.js";
import type { AgenteId } from "../agents/prompts/index.js";

// Fase 4 — snapshot versionado do contexto de negócio no momento em que uma
// missão é confirmada: prova auditável de "que dado o Vetor tinha na mão
// quando planejou isto", sem reenviar o banco inteiro a cada chamada de
// agente (ver docs do comando: "O contexto deve ser filtrado por agente").
// Não substitui o fetch ao vivo que specialistRunner já faz por etapa — é o
// registro histórico, útil pra auditoria e pra futura reconstrução de plano.

export interface BusinessContextSnapshot {
  clienteId: string;
  missionId: string;
  brandKitVersao: number | null;
  audience: unknown;
  offers: unknown[];
  goals: unknown[];
  connectedChannels: Array<{ provider: string; status: string }>;
  restrictions: unknown[];
  sourceVersions: { businessProfileUpdatedAt: string | null; brandKitVersao: number | null };
  confirmedAt: string;
}

export async function criarSnapshotDeContexto(clienteId: string, missionId: string): Promise<BusinessContextSnapshot> {
  const [{ data: perfil }, { data: brandKit }, { data: conexoes }] = await Promise.all([
    supabase
      .from("business_profiles")
      .select("publico, objetivos, produtos_ofertas, restricoes, updated_at")
      .eq("cliente_id", clienteId)
      .maybeSingle(),
    supabase
      .from("brand_kits")
      .select("versao")
      .eq("cliente_id", clienteId)
      .eq("is_atual", true)
      .maybeSingle(),
    supabase.from("connections").select("provider, status").eq("cliente_id", clienteId).eq("status", "connected"),
  ]);

  const snapshot: BusinessContextSnapshot = {
    clienteId,
    missionId,
    brandKitVersao: (brandKit?.versao as number | undefined) ?? null,
    audience: perfil?.publico ?? {},
    offers: (perfil?.produtos_ofertas as unknown[]) ?? [],
    goals: (perfil?.objetivos as unknown[]) ?? [],
    connectedChannels: (conexoes ?? []).map((c) => ({ provider: c.provider as string, status: c.status as string })),
    restrictions: (perfil?.restricoes as unknown[]) ?? [],
    sourceVersions: {
      businessProfileUpdatedAt: (perfil?.updated_at as string | undefined) ?? null,
      brandKitVersao: (brandKit?.versao as number | undefined) ?? null,
    },
    confirmedAt: new Date().toISOString(),
  };

  const { error } = await supabase.from("business_context_snapshots").insert({
    cliente_id: clienteId,
    mission_id: missionId,
    brand_kit_versao: snapshot.brandKitVersao,
    audience: snapshot.audience,
    offers: snapshot.offers,
    goals: snapshot.goals,
    connected_channels: snapshot.connectedChannels,
    restrictions: snapshot.restrictions,
    source_versions: snapshot.sourceVersions,
    confirmed_at: snapshot.confirmedAt,
  });
  // Nunca bloqueia a criação da missão por causa do snapshot — é auditoria,
  // não pré-condição de execução (mesma postura de outros efeitos colaterais
  // não-críticos neste módulo, ex: mission_events).
  if (error) console.warn(`Falha ao gravar business_context_snapshot da missão ${missionId}:`, error.message);

  return snapshot;
}

// Filtra o snapshot pro que cada especialista realmente precisa — nunca
// manda o negócio inteiro pra quem só precisa de uma fatia (ex: Tráfego não
// precisa da voz da marca; Design não precisa de métricas de campanha).
export function contextoParaAgente(agente: AgenteId, snapshot: BusinessContextSnapshot): Record<string, unknown> {
  switch (agente) {
    case "design":
      return { offers: snapshot.offers, brandKitVersao: snapshot.brandKitVersao };
    case "social-media":
      return { audience: snapshot.audience, goals: snapshot.goals, restrictions: snapshot.restrictions };
    case "trafego":
      return {
        goals: snapshot.goals,
        connectedChannels: snapshot.connectedChannels.filter((c) => c.provider === "meta_ads"),
      };
    case "growth":
      return { audience: snapshot.audience, goals: snapshot.goals, offers: snapshot.offers, restrictions: snapshot.restrictions };
    case "analitico":
      return { goals: snapshot.goals, connectedChannels: snapshot.connectedChannels };
    case "estrategia":
    case "vetor":
    default:
      return {
        audience: snapshot.audience,
        goals: snapshot.goals,
        offers: snapshot.offers,
        restrictions: snapshot.restrictions,
        connectedChannels: snapshot.connectedChannels,
      };
  }
}
