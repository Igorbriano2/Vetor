import { createHash } from "node:crypto";
import { supabase } from "../db/supabase.js";
import {
  transicionarMissao,
  transicionarEtapa,
  transicionarSolicitacao,
  type MissionStatus,
  type StepStatus,
  type SolicitacaoStatus,
} from "./stateMachine.js";
import { avaliarRisco, precisaAprovacao, bloqueiaExecucaoAutomatica, type Risco } from "./policyEngine.js";
import { enfileirarPlanMission, enfileirarRunAgentStep } from "../queue/missionQueue.js";
import { executarEspecialista, type ContextoMissaoParaEspecialista } from "../agents/specialistRunner.js";
import { criarSnapshotDeContexto } from "./businessContextSnapshot.js";
import { buscarAssetsRelevantes } from "../negocio/businessAssets.js";
import { buscarContextoTrafego } from "../connections/metaAdsSync.js";
import type { AgenteId } from "../agents/prompts/index.js";

// Agentes cuja etapa promete uma entrega verificável (arte, vídeo,
// planejamento) — nunca "completed" sem artifact_id real. Achado real: uma
// etapa de "estrategia" com a tarefa "consolidar... em documento único de
// planejamento mensal" fechou "completed" com um resumo convincente mas
// SEM chamar entregar_resultado.artifacts — zero linhas em `artifacts`,
// zero prova real, nada além de texto bonito (ver item 11 de
// docs/STATUS-REAL-ATUAL.md). "estrategia" entra aqui porque seu mandato
// (Planejamento) é literalmente produzir o documento — growth/trafego/
// social-media/analitico continuam de fora porque neles uma etapa
// legítima pode ser só análise, sem deliverable próprio.
const DEPARTAMENTOS_EXIGEM_ARTEFATO = new Set<AgenteId>(["design", "video", "estrategia"]);

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
  titulo: string;
  objetivo: string;
  hipotese: string | null;
}

async function buscarMissao(missionId: string): Promise<MissionRow> {
  const { data, error } = await supabase
    .from("missions")
    .select("id, cliente_id, status, titulo, objetivo, hipotese")
    .eq("id", missionId)
    .single();
  if (error || !data) throw new Error(`Missão ${missionId} não encontrada: ${error?.message}`);
  return data as MissionRow;
}

// Ator que provocou uma transição — "sistema" cobre o caminho automático do
// orchestrator/worker; "cliente"/"usuario" cobrem decisão humana (aprovação).
export interface Ator {
  tipo: "sistema" | "cliente" | "usuario";
  id?: string;
}

const ATOR_SISTEMA: Ator = { tipo: "sistema" };

async function registrarEventoMissao(params: {
  missionId: string;
  clienteId: string;
  stepId?: string;
  estadoAnterior: string | null;
  estadoNovo: string;
  ator: Ator;
  motivo?: string;
}): Promise<void> {
  await supabase.from("mission_events").insert({
    mission_id: params.missionId,
    mission_step_id: params.stepId ?? null,
    cliente_id: params.clienteId,
    ator_tipo: params.ator.tipo,
    ator_id: params.ator.id ?? null,
    estado_anterior: params.estadoAnterior,
    estado_novo: params.estadoNovo,
    motivo: params.motivo ?? null,
  });
}

async function atualizarStatusMissao(
  missionId: string,
  atual: MissionStatus,
  proximo: MissionStatus,
  opcoes: { clienteId?: string; ator?: Ator; motivo?: string } = {},
): Promise<void> {
  transicionarMissao(atual, proximo); // lança TransicaoInvalidaError se inválida
  const { error } = await supabase.from("missions").update({ status: proximo, updated_at: new Date().toISOString() }).eq("id", missionId);
  if (error) throw new Error(`Falha ao atualizar status da missão ${missionId}: ${error.message}`);

  const clienteId = opcoes.clienteId ?? (await buscarMissao(missionId)).cliente_id;
  await registrarEventoMissao({
    missionId,
    clienteId,
    estadoAnterior: atual,
    estadoNovo: proximo,
    ator: opcoes.ator ?? ATOR_SISTEMA,
    motivo: opcoes.motivo,
  });
}

async function atualizarStatusEtapa(
  stepId: string,
  atual: StepStatus,
  proximo: StepStatus,
  opcoes: { missionId: string; clienteId: string; ator?: Ator; motivo?: string },
): Promise<void> {
  transicionarEtapa(atual, proximo);
  const { error } = await supabase.from("mission_steps").update({ status: proximo, updated_at: new Date().toISOString() }).eq("id", stepId);
  if (error) throw new Error(`Falha ao atualizar status da etapa ${stepId}: ${error.message}`);

  await registrarEventoMissao({
    missionId: opcoes.missionId,
    clienteId: opcoes.clienteId,
    stepId,
    estadoAnterior: atual,
    estadoNovo: proximo,
    ator: opcoes.ator ?? ATOR_SISTEMA,
    motivo: opcoes.motivo,
  });
}

// sha256 de uma versão canônica do plano (etapas ordenadas por chave, chaves
// de objeto em ordem fixa) — usado pra provar que a missão foi criada a
// partir exatamente do plano que o humano confirmou no IntentCard.
export function calcularHashPlano(plano: PlanoConfirmado): string {
  const canonico = {
    titulo: plano.titulo,
    objetivo: plano.objetivo,
    hipotese: plano.hipotese ?? null,
    criterioSucesso: [...plano.criterioSucesso].sort(),
    etapas: [...plano.etapas]
      .sort((a, b) => a.chave.localeCompare(b.chave))
      .map((e) => ({
        chave: e.chave,
        agente: e.agente,
        tarefa: e.tarefa,
        dependeDe: [...e.dependeDe].sort(),
        ferramentas: [...e.ferramentas].sort(),
      })),
  };
  return createHash("sha256").update(JSON.stringify(canonico)).digest("hex");
}

export interface ConfirmacaoMissao {
  // Liga a missão à solicitação que a originou — ver
  // supabase/migrations/0009_conversas_solicitacoes.sql. Quando presente,
  // criarMissaoDeIntencao vira idempotente: confirmar duas vezes a mesma
  // solicitação nunca cria duas missões (Fase 5 — "confirmação cria missão
  // apenas uma vez").
  solicitacaoId?: string;
  confirmadoPor?: string; // usuario_id, nunca confiar em cliente_id vindo do navegador
  contextoSnapshot?: Record<string, unknown>;
  orcamentoConfirmadoCentavos?: number;
  prazoConfirmado?: string;
}

// 1) Cria a missão + etapas a partir do plano já confirmado pelo humano.
// Não chama LLM aqui — a proposta já veio pronta do Vetor via propor_missao.
// Transição draft -> understanding -> planned é síncrona (o "entendimento" já
// aconteceu na conversa que gerou o plano confirmado). Risco de cada etapa é
// SEMPRE recalculado aqui a partir de policyEngine/tools/registry — nunca
// aceito do que veio do navegador (Fase 4: "nunca confie em risco... vindos
// apenas do navegador").
export async function criarMissaoDeIntencao(
  clienteId: string,
  plano: PlanoConfirmado,
  confirmacao: ConfirmacaoMissao = {},
): Promise<{ missionId: string; idempotente: boolean }> {
  let statusSolicitacaoAtual: SolicitacaoStatus | undefined;
  if (confirmacao.solicitacaoId) {
    const { data: solicitacaoExistente } = await supabase
      .from("solicitacoes")
      .select("mission_id, status")
      .eq("id", confirmacao.solicitacaoId)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (solicitacaoExistente?.mission_id) {
      return { missionId: solicitacaoExistente.mission_id as string, idempotente: true };
    }
    statusSolicitacaoAtual = solicitacaoExistente?.status as SolicitacaoStatus | undefined;
  }

  const planHash = calcularHashPlano(plano);

  const { data: missao, error: erroMissao } = await supabase
    .from("missions")
    .insert({
      cliente_id: clienteId,
      titulo: plano.titulo,
      objetivo: plano.objetivo,
      hipotese: plano.hipotese ?? null,
      criterio_sucesso: plano.criterioSucesso,
      status: "draft",
      plan_hash: planHash,
      contexto_snapshot: confirmacao.contextoSnapshot ?? null,
      confirmado_por: confirmacao.confirmadoPor ?? null,
      confirmado_em: new Date().toISOString(),
      orcamento_confirmado_centavos: confirmacao.orcamentoConfirmadoCentavos ?? null,
      prazo_confirmado: confirmacao.prazoConfirmado ?? null,
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

  await atualizarStatusMissao(missionId, "draft", "understanding", { clienteId });
  await atualizarStatusMissao(missionId, "understanding", "planned", { clienteId });

  if (confirmacao.solicitacaoId) {
    // planned -> confirmed -> converted_to_mission: dois hops validados pela
    // state machine, nunca um update solto (lifecycle de solicitação sempre
    // passa por transicionarSolicitacao — mesma postura de defesa em
    // profundidade usada para missão/etapa).
    if (statusSolicitacaoAtual === "planned") {
      transicionarSolicitacao("planned", "confirmed");
      transicionarSolicitacao("confirmed", "converted_to_mission");
    } else if (statusSolicitacaoAtual !== undefined) {
      // Estado inesperado pra uma confirmação (o IntentCard só existe quando a
      // solicitação está "planned") — não bloqueia a criação da missão, só
      // deixa o desvio visível pra investigar depois.
      console.warn(
        `Missão ${missionId} confirmada a partir de solicitação ${confirmacao.solicitacaoId} em status inesperado "${statusSolicitacaoAtual}" (esperado "planned").`,
      );
    }

    await supabase
      .from("solicitacoes")
      .update({ mission_id: missionId, status: "converted_to_mission", updated_at: new Date().toISOString() })
      .eq("id", confirmacao.solicitacaoId);
  }

  // Auditoria (Fase 4) — nunca bloqueia a criação da missão se falhar (ver
  // comentário em criarSnapshotDeContexto).
  await criarSnapshotDeContexto(clienteId, missionId);

  await enfileirarPlanMission({ missionId });

  return { missionId, idempotente: false };
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
      await atualizarStatusEtapa(etapa.id, etapa.status as StepStatus, "awaiting_approval", {
        missionId,
        clienteId: missao.cliente_id,
      });
    }
    await atualizarStatusMissao(missionId, "planned", "awaiting_approval", { clienteId: missao.cliente_id });
    // Etapas de baixo risco sem dependência ainda podem avançar em paralelo às
    // aprovações pendentes — avancarMissao decide isso olhando status real de cada uma.
  } else {
    await atualizarStatusMissao(missionId, "planned", "queued", { clienteId: missao.cliente_id });
    await atualizarStatusMissao(missionId, "queued", "running", { clienteId: missao.cliente_id });
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
  const etapasParaAvancar = (etapas ?? []).filter((etapa) => {
    if (etapa.status !== "pending") return false;
    const dependencias: string[] = etapa.depende_de ?? [];
    return dependencias.every((id) => statusPorId.get(id) === "completed");
  });

  if (etapasParaAvancar.length > 0) {
    const clienteId = (await buscarMissao(missionId)).cliente_id;
    for (const etapa of etapasParaAvancar) {
      await atualizarStatusEtapa(etapa.id, "pending", "ready", { missionId, clienteId });
      await enfileirarRunAgentStep({ missionStepId: etapa.id });
    }
  }

  await checarConclusaoMissao(missionId);
}

async function checarConclusaoMissao(missionId: string): Promise<void> {
  const { data: etapas } = await supabase.from("mission_steps").select("status, resultado").eq("mission_id", missionId);
  if (!etapas || etapas.length === 0) return;

  const todasFinalizadas = etapas.every((e) => ["completed", "skipped", "cancelled"].includes(e.status as string));
  const algumaFalhou = etapas.some((e) => e.status === "failed");

  if (algumaFalhou) return; // fica bloqueada/rodando; não fecha sozinha em caso de falha
  if (!todasFinalizadas) return;

  const missao = await buscarMissao(missionId);
  if (missao.status !== "running") return;

  // Checkpoint de qualidade: alguma etapa completou com baixa confiança? A
  // missão não fecha como "completed" limpo — passa por quality_review e
  // resolve como completed_with_caveats, com o motivo registrado no evento
  // (hoje resolvido automaticamente; não há revisão humana intermediária
  // nesta rodada, ver relatório final). "needs_clarification" do especialista
  // já vira step status "failed" antes de chegar aqui (comportamento
  // pré-existente, fora do escopo desta mudança).
  const ressalvas = etapas
    .map((e) => e.resultado as { confidence?: number; summary?: string } | null)
    .filter((r): r is { confidence?: number; summary?: string } => !!r)
    .filter((r) => typeof r.confidence === "number" && r.confidence < 0.5);

  if (ressalvas.length > 0) {
    const motivo = `${ressalvas.length} etapa(s) com baixa confiança ou pedindo esclarecimento: ${ressalvas
      .map((r) => r.summary)
      .filter(Boolean)
      .join(" | ")}`;
    await atualizarStatusMissao(missionId, "running", "quality_review", { clienteId: missao.cliente_id, motivo });
    await atualizarStatusMissao(missionId, "quality_review", "completed_with_caveats", {
      clienteId: missao.cliente_id,
      motivo,
    });
    return;
  }

  await atualizarStatusMissao(missionId, "running", "completed", { clienteId: missao.cliente_id });
}

// 4) Job "run-agent-step": chama o especialista de fato e grava o resultado.
export async function processarRunAgentStep(missionStepId: string): Promise<void> {
  const { data: etapa, error } = await supabase
    .from("mission_steps")
    .select("id, mission_id, cliente_id, agente, tarefa, status, ferramentas, depende_de")
    .eq("id", missionStepId)
    .single();
  if (error || !etapa) throw new Error(`Etapa ${missionStepId} não encontrada: ${error?.message}`);

  // Resultado real das etapas das quais esta depende — sem isso, uma etapa
  // que precisa de um id criado por uma etapa anterior (ex: video_project_id
  // de editar_video_timeline, usado depois por finalizar_video_com_legendas)
  // não tinha como saber esse id (achado real na prova do Videomaker).
  const dependeDe = (etapa.depende_de as string[] | null) ?? [];
  let etapasAnteriores: Array<{ tarefa: string; resultado: unknown }> | undefined;
  if (dependeDe.length > 0) {
    const { data: anteriores } = await supabase.from("mission_steps").select("tarefa, resultado").in("id", dependeDe);
    if (anteriores?.length) etapasAnteriores = anteriores.map((a) => ({ tarefa: a.tarefa as string, resultado: a.resultado }));
  }

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
    .select("cores, fontes, regras, logo_area_protecao, logo_tamanho_minimo, logo_fundos_proibidos, logo_usos_proibidos")
    .eq("cliente_id", etapa.cliente_id)
    .eq("is_atual", true)
    .maybeSingle();

  // Banco de imagens só custa a chamada extra pra quem de fato produz peça
  // visual — os demais agentes não precisam disso no contexto.
  const assetsDisponiveis =
    etapa.agente === "design" || etapa.agente === "video"
      ? await buscarAssetsRelevantes(etapa.cliente_id)
      : undefined;

  // Só custa a consulta extra pra quem de fato analisa/audita tráfego pago —
  // nunca inventa campanha: sem conexão Meta ativa, contaConectada fica false
  // e a lista vem vazia (ver montarContexto em specialistRunner.ts).
  const trafego =
    etapa.agente === "trafego" || etapa.agente === "analitico" ? await buscarContextoTrafego(etapa.cliente_id) : undefined;

  const contexto: ContextoMissaoParaEspecialista = {
    missaoTitulo: missao.titulo,
    missaoObjetivo: missao.objetivo,
    missaoHipotese: missao.hipotese,
    etapaTarefa: etapa.tarefa,
    negocio: {
      nomeEmpresa: cliente?.nome_empresa ?? "cliente",
      nicho: cliente?.nicho ?? "outro",
      perfil: perfil ?? null,
      brandKit: brandKit ?? null,
      assetsDisponiveis,
    },
    trafego,
    etapasAnteriores,
  };

  const opcoesEtapa = { missionId: etapa.mission_id as string, clienteId: etapa.cliente_id as string };

  // Achado real: BullMQ pode reentregar o job (worker reiniciado/deploy no
  // meio de uma execução longa, ver "stalled jobs") enquanto a etapa já
  // está "running" de uma tentativa anterior — transicionar "running" ->
  // "running" é inválido na state machine e derrubava o job antes de rodar
  // o especialista de verdade. Já estar "running" não é erro aqui, é só
  // uma reentrega — segue direto pra execução em vez de re-transicionar.
  if (etapa.status !== "running") {
    await atualizarStatusEtapa(etapa.id, etapa.status as StepStatus, "running", opcoesEtapa);
  }

  try {
    const resultado = await executarEspecialista(
      etapa.agente as AgenteId,
      contexto,
      etapa.id,
      etapa.cliente_id,
      etapa.mission_id as string,
    );

    // Correção de princípio (auditoria de arquitetura): Design e Vídeo
    // prometem uma entrega verificável — nunca "completed" só com um resumo
    // dizendo que algo foi criado. Se o especialista disse completed sem
    // nenhum artifact_id real, a etapa vira failed de verdade, com o motivo
    // explícito, em vez de deixar o cliente achar que recebeu algo que não
    // existe (o que gerava o "peça manualmente a arte que o Vetor alegou ter
    // feito", visto no print da auditoria). "Verificável" também inclui um
    // video_project ou reference_video_profile real persistido — nem toda
    // entrega de Vídeo é um arquivo genérico (editar_video_timeline e
    // analisar_video_de_referencia produzem uma linha real no banco, não um
    // artifact solto, ver criaArtefatoGenerico em specialistRunner.ts).
    // "estrategia" só precisa de artifact_id na etapa TERMINAL (nenhuma
    // outra etapa da mesma missão depende dela) — achado real: uma etapa
    // de "analisar perfil do negócio..." (puramente investigativa, cujo
    // resultado outras etapas consomem via etapasAnteriores) passou a
    // falhar sem necessidade quando o guard-rail exigia artifact_id em
    // TODA etapa de estrategia. design/video continuam exigindo sempre,
    // porque lá cada etapa já É a entrega (nunca um passo intermediário).
    let etapaExigeArtefato = DEPARTAMENTOS_EXIGEM_ARTEFATO.has(etapa.agente);
    if (etapaExigeArtefato && etapa.agente === "estrategia") {
      const { data: dependentes } = await supabase
        .from("mission_steps")
        .select("id")
        .eq("mission_id", etapa.mission_id as string)
        .contains("depende_de", [etapa.id]);
      etapaExigeArtefato = !dependentes || dependentes.length === 0;
    }

    const temEntregaVerificavel = resultado.artifactIds.length > 0 || !!resultado.videoProjectId || !!resultado.referenceVideoProfileId;
    if (resultado.status === "completed" && etapaExigeArtefato && !temEntregaVerificavel) {
      resultado.status = "failed";
      resultado.summary = `Etapa marcada como falha: nenhum artefato verificável foi produzido, apesar do resumo original ("${resultado.summary}"). Nunca completar uma entrega de ${etapa.agente} sem artifact_id.`;
    }

    // Drive de ativos empresariais: quando existe logo oficial cadastrada
    // mas ela não pôde ser aplicada de verdade na peça (brandValidation.passed
    // false), a entrega não pode ficar "completed" — precisa de correção ou
    // aprovação humana, nunca "pronta" com a marca ausente/errada. Não bloqueia
    // quando simplesmente não existe logo cadastrada (isso é permitido e só
    // fica disclosurado no summary, ver specialistRunner.ts).
    if (resultado.status === "completed" && resultado.brandValidation && !resultado.brandValidation.passed) {
      resultado.status = "failed";
      resultado.summary = `Etapa marcada como falha: validação de marca não passou (${resultado.brandValidation.issues.join(" ")}). Resumo original: "${resultado.summary}".`;
    }

    await supabase.from("mission_steps").update({ resultado }).eq("id", etapa.id);

    if (resultado.status === "completed") {
      await atualizarStatusEtapa(etapa.id, "running", "completed", { ...opcoesEtapa, motivo: resultado.summary });
    } else {
      await atualizarStatusEtapa(etapa.id, "running", "failed", { ...opcoesEtapa, motivo: resultado.summary });
    }
  } catch (err) {
    await atualizarStatusEtapa(etapa.id, "running", "failed", {
      ...opcoesEtapa,
      motivo: err instanceof Error ? err.message : "erro desconhecido",
    });
    throw err;
  }

  await avancarMissao(etapa.mission_id);
}

// Lançado quando o cliente autenticado tenta decidir uma aprovação que não é
// dele — rota chama isso pra devolver 403, não 500.
export class AprovacaoDeOutroClienteError extends Error {
  constructor(approvalId: string) {
    super(`Aprovação ${approvalId} não pertence a este cliente`);
    this.name = "AprovacaoDeOutroClienteError";
  }
}

// 5) Decisão humana sobre uma aprovação pendente. `clienteId` vem da sessão
// autenticada resolvida pelo painel (nunca do corpo da requisição) — o Supabase
// client aqui é service-role e ignora RLS, então a checagem de posse precisa
// ser explícita, ou qualquer cliente autenticado aprova/rejeita missão alheia.
export async function decidirAprovacao(
  approvalId: string,
  decisao: "aprovar" | "rejeitar",
  usuarioId: string,
  clienteId: string,
): Promise<void> {
  const { data: aprovacao, error } = await supabase
    .from("approvals")
    .select("id, mission_id, mission_step_id, status, cliente_id")
    .eq("id", approvalId)
    .single();
  if (error || !aprovacao) throw new Error(`Aprovação ${approvalId} não encontrada: ${error?.message}`);
  if (aprovacao.cliente_id !== clienteId) throw new AprovacaoDeOutroClienteError(approvalId);
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

  const ator: Ator = { tipo: "usuario", id: usuarioId };

  if (decisao === "aprovar") {
    await atualizarStatusEtapa(aprovacao.mission_step_id, "awaiting_approval", "ready", {
      missionId: aprovacao.mission_id,
      clienteId,
      ator,
    });
    await enfileirarRunAgentStep({ missionStepId: aprovacao.mission_step_id });
  } else {
    await atualizarStatusEtapa(aprovacao.mission_step_id, "awaiting_approval", "cancelled", {
      missionId: aprovacao.mission_id,
      clienteId,
      ator,
    });
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
      await atualizarStatusMissao(aprovacao.mission_id, "awaiting_approval", "queued", { clienteId, ator });
      await atualizarStatusMissao(aprovacao.mission_id, "queued", "running", { clienteId, ator });
    }
  }

  await avancarMissao(aprovacao.mission_id);
}
