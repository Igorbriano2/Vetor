import { supabase } from "../db/supabase.js";
import { transicionarMissao, transicionarEtapa, type MissionStatus, type StepStatus } from "./stateMachine.js";
import { avaliarRisco, precisaAprovacao, bloqueiaExecucaoAutomatica, type Risco } from "./policyEngine.js";
import { enfileirarPlanMission, enfileirarRunAgentStep } from "../queue/missionQueue.js";
import { executarEspecialista, type ContextoMissaoParaEspecialista } from "../agents/specialistRunner.js";
import type { AgenteId } from "../agents/prompts/index.js";

// Plano confirmado pelo humano no painel (vem do tool propor_missao do Vetor,
// já revisado via IntentCard) — ver docs/manus-jarvis-spec/docs/04-agentes-e-prompts.md
// §3 (VetorPlan). `chave` é um identificador local só para resolver dependências
// antes das etapas existirem no banco (que gera uuid próprio).
export interface EtapaPlano {
  chave: string;
  agente: AgenteId;
  tarefa: string;
  dependeDe: string[];
  ferramentas: string[];
}

export interface PlanoConfirmado {
  titulo: string;
  objetivo: string;
  hipotese?: string;
  criterioSucesso: string[];
  etapas: EtapaPlano[];
}

interface MissionRow {
  id: string;
  cliente_id: string;
  status: MissionStatus;
  objetivo: string;
  hipotese: string | null;
}

async function buscarMissao(missionId: string): Promise<MissionRow> {
  const { data, error } = await supabase
    .from("missions")
    .select("id, cliente_id, status, objetivo, hipotese")
    .eq("id", missionId)
    .single();
  if (error || !data) throw new Error(`Missão ${missionId} não encontrada: ${error?.message}`);
  return data as MissionRow;
}

async function atualizarStatusMissao(missionId: string, atual: MissionStatus, proximo: MissionStatus): Promise<void> {
  transicionarMissao(atual, proximo); // lança TransicaoInvalidaError se inválida
  const { error } = await supabase.from("missions").update({ status: proximo, updated_at: new Date().toISOString() }).eq("id", missionId);
  if (error) throw new Error(`Falha ao atualizar status da missão ${missionId}: ${error.message}`);
}

async function atualizarStatusEtapa(stepId: string, atual: StepStatus, proximo: StepStatus): Promise<void> {
  transicionarEtapa(atual, proximo);
  const { error } = await supabase.from("mission_steps").update({ status: proximo, updated_at: new Date().toISOString() }).eq("id", stepId);
  if (error) throw new Error(`Falha ao atualizar status da etapa ${stepId}: ${error.message}`);
}

// 1) Cria a missão + etapas a partir do plano já confirmado pelo humano.
// Não chama LLM aqui — a proposta já veio pronta do Vetor via propor_missao.
// Transição draft -> understanding -> planned é síncrona (o "entendimento" já
// aconteceu na conversa que gerou o plano confirmado).
export async function criarMissaoDeIntencao(clienteId: string, plano: PlanoConfirmado): Promise<{ missionId: string }> {
  const { data: missao, error: erroMissao } = await supabase
    .from("missions")
    .insert({
      cliente_id: clienteId,
      titulo: plano.titulo,
      objetivo: plano.objetivo,
      hipotese: plano.hipotese ?? null,
      criterio_sucesso: plano.criterioSucesso,
      status: "draft",
    })
    .select("id")
    .single();
  if (erroMissao || !missao) throw new Error(`Falha ao criar missão: ${erroMissao?.message}`);

  const missionId = missao.id as string;

  // Insere etapas sem depende_de (ainda não temos os uuids reais), guardando
  // o mapa chave local -> id real para resolver as dependências no passo seguinte.
  const chaveParaId = new Map<string, string>();
  for (const etapa of plano.etapas) {
    const risco: Risco = avaliarRisco(etapa.ferramentas);
    const { data: etapaCriada, error } = await supabase
      .from("mission_steps")
      .insert({
        mission_id: missionId,
        cliente_id: clienteId,
        agente: etapa.agente,
        tarefa: etapa.tarefa,
        ferramentas: etapa.ferramentas,
        risco,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !etapaCriada) throw new Error(`Falha ao criar etapa "${etapa.chave}": ${error?.message}`);
    chaveParaId.set(etapa.chave, etapaCriada.id as string);
  }

  for (const etapa of plano.etapas) {
    const dependeDeIds = etapa.dependeDe.map((chave) => chaveParaId.get(chave)).filter((id): id is string => !!id);
    if (dependeDeIds.length === 0) continue;
    await supabase.from("mission_steps").update({ depende_de: dependeDeIds }).eq("id", chaveParaId.get(etapa.chave));
  }

  await atualizarStatusMissao(missionId, "draft", "understanding");
  await atualizarStatusMissao(missionId, "understanding", "planned");

  await enfileirarPlanMission({ missionId });

  return { missionId };
}

// 2) Job "plan-mission": passa cada etapa pelo Policy Engine, cria aprovações
// pendentes quando necessário, e enfileira as etapas sem dependência (as raízes
// do plano) para execução.
export async function processarPlanMission(missionId: string): Promise<void> {
  const missao = await buscarMissao(missionId);

  const { data: etapas, error } = await supabase
    .from("mission_steps")
    .select("id, agente, tarefa, depende_de, ferramentas, risco, status")
    .eq("mission_id", missionId);
  if (error) throw new Error(`Falha ao ler etapas da missão ${missionId}: ${error.message}`);

  const algumaPrecisaAprovacao = (etapas ?? []).some((e) => precisaAprovacao(e.risco as Risco));

  if (algumaPrecisaAprovacao) {
    for (const etapa of etapas ?? []) {
      if (!precisaAprovacao(etapa.risco as Risco)) continue;
      await supabase.from("approvals").insert({
        mission_id: missionId,
        mission_step_id: etapa.id,
        cliente_id: missao.cliente_id,
        acao: etapa.tarefa,
        payload: { ferramentas: etapa.ferramentas, agente: etapa.agente },
        risco: etapa.risco,
        status: "pending",
      });
      await atualizarStatusEtapa(etapa.id, etapa.status as StepStatus, "awaiting_approval");
    }
    await atualizarStatusMissao(missionId, "planned", "awaiting_approval");
    // Etapas de baixo risco sem dependência ainda podem avançar em paralelo às
    // aprovações pendentes — avancarMissao decide isso olhando status real de cada uma.
  } else {
    await atualizarStatusMissao(missionId, "planned", "queued");
    await atualizarStatusMissao(missionId, "queued", "running");
  }

  await avancarMissao(missionId);
}

// 3) Avança a missão: acha etapas "pending" cujas dependências diretas já
// completaram e as marca "ready" + enfileira execução. Limitação explícita da
// v1: não é um scheduler DAG geral, só "todas as dependências diretas completas"
// — suficiente para planos rasos (2-4 etapas) que o Vetor gera nesta fase.
export async function avancarMissao(missionId: string): Promise<void> {
  const { data: etapas, error } = await supabase
    .from("mission_steps")
    .select("id, status, depende_de")
    .eq("mission_id", missionId);
  if (error) throw new Error(`Falha ao ler etapas da missão ${missionId}: ${error.message}`);

  const statusPorId = new Map((etapas ?? []).map((e) => [e.id as string, e.status as StepStatus]));

  for (const etapa of etapas ?? []) {
    if (etapa.status !== "pending") continue;
    const dependencias: string[] = etapa.depende_de ?? [];
    const todasCompletas = dependencias.every((id) => statusPorId.get(id) === "completed");
    if (!todasCompletas) continue;

    await atualizarStatusEtapa(etapa.id, "pending", "ready");
    await enfileirarRunAgentStep({ missionStepId: etapa.id });
  }

  await checarConclusaoMissao(missionId);
}

async function checarConclusaoMissao(missionId: string): Promise<void> {
  const { data: etapas } = await supabase.from("mission_steps").select("status").eq("mission_id", missionId);
  if (!etapas || etapas.length === 0) return;

  const todasFinalizadas = etapas.every((e) => ["completed", "skipped", "cancelled"].includes(e.status as string));
  const algumaFalhou = etapas.some((e) => e.status === "failed");

  if (algumaFalhou) return; // fica bloqueada/rodando; não fecha sozinha em caso de falha
  if (!todasFinalizadas) return;

  const missao = await buscarMissao(missionId);
  if (missao.status === "running") {
    await atualizarStatusMissao(missionId, "running", "completed");
  }
}

// 4) Job "run-agent-step": chama o especialista de fato e grava o resultado.
export async function processarRunAgentStep(missionStepId: string): Promise<void> {
  const { data: etapa, error } = await supabase
    .from("mission_steps")
    .select("id, mission_id, cliente_id, agente, tarefa, status, ferramentas")
    .eq("id", missionStepId)
    .single();
  if (error || !etapa) throw new Error(`Etapa ${missionStepId} não encontrada: ${error?.message}`);

  const ferramentaBloqueada = (etapa.ferramentas as string[]).some(bloqueiaExecucaoAutomatica);
  if (ferramentaBloqueada) {
    // Já deveria ter passado por aprovação em processarPlanMission (essas
    // ferramentas são sempre risco alto). Guarda extra: nunca executa sozinho.
    return;
  }

  const missao = await buscarMissao(etapa.mission_id);

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome_empresa, nicho")
    .eq("id", etapa.cliente_id)
    .single();

  const { data: perfil } = await supabase
    .from("business_profiles")
    .select("descricao, tom, ofertas, publico")
    .eq("cliente_id", etapa.cliente_id)
    .maybeSingle();

  const { data: brandKit } = await supabase
    .from("brand_kits")
    .select("cores, fontes, regras")
    .eq("cliente_id", etapa.cliente_id)
    .eq("is_atual", true)
    .maybeSingle();

  const contexto: ContextoMissaoParaEspecialista = {
    missaoObjetivo: missao.objetivo,
    missaoHipotese: missao.hipotese,
    etapaTarefa: etapa.tarefa,
    negocio: {
      nomeEmpresa: cliente?.nome_empresa ?? "cliente",
      nicho: cliente?.nicho ?? "outro",
      perfil: perfil ?? null,
      brandKit: brandKit ?? null,
    },
  };

  await atualizarStatusEtapa(etapa.id, etapa.status as StepStatus, "running");

  try {
    const resultado = await executarEspecialista(etapa.agente as AgenteId, contexto, etapa.id, etapa.cliente_id);
    await supabase.from("mission_steps").update({ resultado }).eq("id", etapa.id);

    if (resultado.status === "completed") {
      await atualizarStatusEtapa(etapa.id, "running", "completed");
    } else {
      await atualizarStatusEtapa(etapa.id, "running", "failed");
    }
  } catch (err) {
    await atualizarStatusEtapa(etapa.id, "running", "failed");
    throw err;
  }

  await avancarMissao(etapa.mission_id);
}

// 5) Decisão humana sobre uma aprovação pendente.
export async function decidirAprovacao(
  approvalId: string,
  decisao: "aprovar" | "rejeitar",
  usuarioId: string,
): Promise<void> {
  const { data: aprovacao, error } = await supabase
    .from("approvals")
    .select("id, mission_id, mission_step_id, status")
    .eq("id", approvalId)
    .single();
  if (error || !aprovacao) throw new Error(`Aprovação ${approvalId} não encontrada: ${error?.message}`);
  if (aprovacao.status !== "pending") throw new Error(`Aprovação ${approvalId} já foi decidida (status: ${aprovacao.status})`);

  await supabase
    .from("approvals")
    .update({
      status: decisao === "aprovar" ? "approved" : "rejected",
      decidido_por: usuarioId,
      decidido_em: new Date().toISOString(),
    })
    .eq("id", approvalId);

  if (!aprovacao.mission_step_id) return;

  if (decisao === "aprovar") {
    await atualizarStatusEtapa(aprovacao.mission_step_id, "awaiting_approval", "ready");
    await enfileirarRunAgentStep({ missionStepId: aprovacao.mission_step_id });
  } else {
    await atualizarStatusEtapa(aprovacao.mission_step_id, "awaiting_approval", "cancelled");
  }

  // Se a missão estava esperando aprovação e não há mais nenhuma pendente,
  // libera o fluxo para seguir rodando.
  const { data: pendentes } = await supabase
    .from("approvals")
    .select("id")
    .eq("mission_id", aprovacao.mission_id)
    .eq("status", "pending");

  if (!pendentes || pendentes.length === 0) {
    const missao = await buscarMissao(aprovacao.mission_id);
    if (missao.status === "awaiting_approval") {
      await atualizarStatusMissao(aprovacao.mission_id, "awaiting_approval", "queued");
      await atualizarStatusMissao(aprovacao.mission_id, "queued", "running");
    }
  }

  await avancarMissao(aprovacao.mission_id);
}
