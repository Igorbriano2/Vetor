import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt, type AgenteId } from "./prompts/index.js";
import { gerarVideoAPartirDeImagem, VideoIndisponivelError } from "../integrations/higgsfield.js";
import { persistirArtefato, type ArtefatoPersistido, type ArtifactType } from "../artifacts/artifactsService.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tipos de artefato que um especialista sem ferramenta de geração real pode
// produzir sozinho — sempre texto (documento/copy/plano/relatório). "image" e
// "video" só existem quando vieram de uma ferramenta de execução real (ver
// rodarComFerramentaDeVideo) — nunca aceitos do que o LLM alega ter feito.
const TIPOS_ARTEFATO_TEXTO = ["copy", "document", "plan", "report"] as const;

// Contrato de saída — espelha AgentResult<T> de
// docs/manus-jarvis-spec/docs/04-agentes-e-prompts.md §2. Forçado via
// tool_choice para nunca sair como prosa livre.
//
// "artifacts" é a correção de princípio da auditoria de arquitetura: uma
// etapa nunca deve alegar "arte criada"/"vídeo pronto" sem um artifact_id
// verificável. Quem só produz texto (a maioria dos agentes hoje, sem
// integração de geração de imagem real) só pode declarar artefatos de tipo
// texto — orchestrator.ts reforça isso de novo no lado do banco antes de
// marcar a etapa como completed.
export const ENTREGAR_RESULTADO_TOOL: Anthropic.Tool = {
  name: "entregar_resultado",
  description: "Entrega o resultado estruturado desta etapa da missão. Sempre use esta ferramenta para responder.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["completed", "failed", "needs_clarification"] },
      summary: { type: "string", description: "Resumo em linguagem natural do que foi feito ou por que não foi possível." },
      confidence: { type: "number", description: "0 a 1." },
      assumptions: { type: "array", items: { type: "string" } },
      evidence: { type: "array", items: { type: "string" } },
      proposedActions: { type: "array", items: { type: "string" } },
      structuredOutput: {
        type: "object",
        description: "Conteúdo específico do agente (texto de copy, briefing de design, plano de tráfego, etc.), livre dentro do domínio do agente.",
      },
      artifacts: {
        type: "array",
        description:
          "Entregas reais desta etapa. Só use type=copy/document/plan/report aqui (texto que você mesmo escreveu). " +
          "NUNCA declare type=image ou type=video — essas só existem quando geradas por uma ferramenta de execução " +
          "real (ex: gerar_video_higgsfield); dizer 'arte criada' sem isso é proibido, use status=completed só para " +
          "o que você de fato produziu (ex: um briefing), e explique no summary o que ainda falta gerar de verdade.",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...TIPOS_ARTEFATO_TEXTO] },
            title: { type: "string" },
            content: { type: "string", description: "O conteúdo de verdade — o texto do briefing/copy/plano/relatório, não um resumo dele." },
          },
          required: ["type", "title", "content"],
        },
      },
      needsApproval: { type: "boolean", description: "Se esta entrega precisa de aprovação humana antes de valer como final." },
      nextAction: { type: "string", description: "Próximo passo sugerido, se houver (ex: 'aguardar aprovação do briefing')." },
    },
    required: ["status", "summary", "confidence"],
  },
};

// Único tool de execução real hoje (os outros agentes só produzem
// texto/estrutura via entregar_resultado) — gera custo real por chamada,
// por isso a etapa já chega aqui como risco "medium" (ver tools/registry.ts,
// exige aprovação antes do worker rodar isto).
const GERAR_VIDEO_TOOL: Anthropic.Tool = {
  name: "gerar_video_higgsfield",
  description: "Gera um vídeo a partir de uma imagem de referência e uma descrição de movimento (Higgsfield).",
  input_schema: {
    type: "object",
    properties: {
      imagem_url: { type: "string", description: "URL pública da imagem de referência." },
      prompt: { type: "string", description: "Descrição do movimento/câmera desejado." },
    },
    required: ["imagem_url", "prompt"],
  },
};

export interface AgentResult {
  status: "completed" | "failed" | "needs_clarification";
  summary: string;
  confidence: number;
  assumptions: string[];
  evidence: string[];
  proposedActions: string[];
  structuredOutput: Record<string, unknown> | null;
  artifactIds: string[];
  artifacts: ArtefatoPersistido[];
  needsApproval: boolean;
  nextAction?: string;
}

export interface ContextoMissaoParaEspecialista {
  missaoObjetivo: string;
  missaoHipotese: string | null;
  etapaTarefa: string;
  negocio: {
    nomeEmpresa: string;
    nicho: string;
    perfil?: { descricao: string | null; tom: string | null; ofertas: unknown; publico: unknown } | null;
    brandKit?: { cores: unknown; fontes: unknown; regras: unknown } | null;
  };
}

// Departamento pro artefato (Design/Videomaker/Tráfego/Planejamento/
// Conteúdo) — usado pra filtrar a biblioteca em Entregas/Design/Videomaker.
const DEPARTAMENTO_POR_AGENTE: Record<AgenteId, string> = {
  design: "design",
  video: "videomaker",
  trafego: "trafego",
  estrategia: "planejamento",
  growth: "planejamento",
  "social-media": "conteudo",
  analitico: "planejamento",
  vetor: "planejamento",
  secretario: "planejamento",
};

function montarContexto(ctx: ContextoMissaoParaEspecialista): string {
  const partes = [
    `MISSÃO — objetivo: ${ctx.missaoObjetivo}`,
    ctx.missaoHipotese ? `Hipótese: ${ctx.missaoHipotese}` : null,
    `SUA ETAPA: ${ctx.etapaTarefa}`,
    `NEGÓCIO: ${ctx.negocio.nomeEmpresa} (nicho: ${ctx.negocio.nicho})`,
    ctx.negocio.perfil?.descricao ? `Perfil de negócio: ${ctx.negocio.perfil.descricao}` : null,
    ctx.negocio.perfil?.tom ? `Tom de voz: ${ctx.negocio.perfil.tom}` : null,
    ctx.negocio.brandKit ? `Brand kit atual: ${JSON.stringify(ctx.negocio.brandKit)}` : null,
  ].filter(Boolean);

  return partes.join("\n");
}

interface ResultadoTurnoVideo {
  message: Anthropic.Message;
  videoGerado?: { url: string; requestId: string };
}

// Único agente com um tool de execução real (gerar_video_higgsfield) além de
// entregar_resultado — loop curto e limitado (máx. 3 idas e voltas): deixa o
// modelo pedir o vídeo, executa de verdade, devolve o resultado real como
// tool_result, e força entregar_resultado se ele não fechar sozinho depois
// de ter o vídeo em mãos (nunca deixa rodar indefinidamente).
async function rodarComFerramentaDeVideo(systemPrompt: string, tarefa: string): Promise<ResultadoTurnoVideo> {
  const mensagens: Anthropic.MessageParam[] = [{ role: "user", content: tarefa }];
  let videoGerado: ResultadoTurnoVideo["videoGerado"];

  for (let turno = 0; turno < 3; turno++) {
    const ultimoTurno = turno === 2;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: mensagens,
      tools: [ENTREGAR_RESULTADO_TOOL, GERAR_VIDEO_TOOL],
      tool_choice: ultimoTurno ? { type: "tool", name: "entregar_resultado" } : { type: "auto" },
    });

    const chamadaVideo = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "gerar_video_higgsfield",
    );
    if (!chamadaVideo) return { message: response, videoGerado };

    mensagens.push({ role: "assistant", content: response.content });

    const input = chamadaVideo.input as { imagem_url: string; prompt: string };
    let resultadoFerramenta: string;
    try {
      const video = await gerarVideoAPartirDeImagem(input.imagem_url, input.prompt);
      videoGerado = video;
      resultadoFerramenta = JSON.stringify({ status: "completed", video_url: video.url, request_id: video.requestId });
    } catch (err) {
      const motivo = err instanceof VideoIndisponivelError ? err.message : err instanceof Error ? err.message : "erro desconhecido";
      resultadoFerramenta = JSON.stringify({ status: "failed", error: motivo });
    }

    mensagens.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: chamadaVideo.id, content: resultadoFerramenta }],
    });
  }

  // Nunca deveria chegar aqui (o último turno força entregar_resultado),
  // mas mantém o contrato de retorno se algo inesperado acontecer.
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: mensagens,
    tools: [ENTREGAR_RESULTADO_TOOL],
    tool_choice: { type: "tool", name: "entregar_resultado" },
  });
  return { message: response, videoGerado };
}

// Executa um especialista (design, trafego, estrategia...) para uma etapa de
// missão e devolve resultado estruturado, sempre validado por schema — ver
// docs/manus-jarvis-spec/docs/03-arquitetura-tecnica.md §3. Genérico: funciona
// para qualquer AgenteId, não é hand-coded por agente.
export async function executarEspecialista(
  agenteId: AgenteId,
  contexto: ContextoMissaoParaEspecialista,
  missionStepId: string,
  clienteId: string,
  missionId?: string,
): Promise<AgentResult> {
  const systemPrompt = `${getSystemPrompt(agenteId)}\n\n${montarContexto(contexto)}`;
  const departamento = DEPARTAMENTO_POR_AGENTE[agenteId];

  let response: Anthropic.Message;
  let videoGerado: ResultadoTurnoVideo["videoGerado"];

  if (agenteId === "video") {
    const resultadoVideo = await rodarComFerramentaDeVideo(systemPrompt, contexto.etapaTarefa);
    response = resultadoVideo.message;
    videoGerado = resultadoVideo.videoGerado;
  } else {
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: contexto.etapaTarefa }],
      tools: [ENTREGAR_RESULTADO_TOOL],
      tool_choice: { type: "tool", name: "entregar_resultado" },
    });
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "entregar_resultado",
  );

  interface ArtefatoBruto {
    type: string;
    title: string;
    content: string;
  }
  const bruto = (toolUse?.input ?? {}) as Partial<AgentResult> & { artifacts?: ArtefatoBruto[] };

  const artefatosPersistidos: ArtefatoPersistido[] = [];

  // Vídeo real gerado pela ferramenta de execução — sempre um artefato real,
  // independente do que o modelo tenha dito em `artifacts` (que só aceita
  // tipos de texto, ver TIPOS_ARTEFATO_TEXTO).
  if (videoGerado) {
    try {
      artefatosPersistidos.push(
        await persistirArtefato({
          clienteId,
          missionId,
          missionStepId,
          type: "video",
          department: departamento,
          title: "Vídeo gerado (Higgsfield)",
          externalUrl: videoGerado.url,
          mimeType: "video/mp4",
          criadoPorAgente: agenteId,
        }),
      );
    } catch (err) {
      console.warn(`Falha ao persistir artefato de vídeo da etapa ${missionStepId}:`, err instanceof Error ? err.message : err);
    }
  }

  // Artefatos de texto declarados pelo modelo — só os tipos permitidos no
  // schema chegam aqui, mas revalida no código mesmo assim (nunca confiar só
  // no schema da API de tool use, ver Fase 4 / bloqueiaExecucaoAutomatica no
  // mesmo espírito).
  for (const item of bruto.artifacts ?? []) {
    if (!(TIPOS_ARTEFATO_TEXTO as readonly string[]).includes(item.type) || !item.content?.trim()) continue;
    try {
      artefatosPersistidos.push(
        await persistirArtefato({
          clienteId,
          missionId,
          missionStepId,
          type: item.type as ArtifactType,
          department: departamento,
          title: item.title || "Sem título",
          content: item.content,
          criadoPorAgente: agenteId,
        }),
      );
    } catch (err) {
      console.warn(`Falha ao persistir artefato "${item.title}" da etapa ${missionStepId}:`, err instanceof Error ? err.message : err);
    }
  }

  const resultado: AgentResult = {
    status: bruto.status ?? "failed",
    summary: bruto.summary ?? "O especialista não retornou um resumo.",
    confidence: typeof bruto.confidence === "number" ? bruto.confidence : 0,
    assumptions: bruto.assumptions ?? [],
    evidence: bruto.evidence ?? [],
    proposedActions: bruto.proposedActions ?? [],
    structuredOutput: (bruto.structuredOutput as Record<string, unknown>) ?? null,
    artifactIds: artefatosPersistidos.map((a) => a.id),
    artifacts: artefatosPersistidos,
    needsApproval: !!bruto.needsApproval,
    nextAction: bruto.nextAction,
  };

  await supabase.from("agent_runs").insert({
    mission_step_id: missionStepId,
    cliente_id: clienteId,
    agente: agenteId,
    modelo: response.model,
    tokens_entrada: response.usage.input_tokens,
    tokens_saida: response.usage.output_tokens,
    resultado,
    erro: resultado.status === "failed" ? resultado.summary : null,
  });

  // Fase 7 — memória operacional: todo resultado de etapa vira uma entrada,
  // rotulada com a confiança real do especialista (nunca tratada como fato
  // definitivo — buscarContextoDeNegocio() reapresenta isso com o rótulo).
  if (resultado.status === "completed") {
    await supabase.from("memoria_operacional").insert({
      cliente_id: clienteId,
      tipo: "resultado_experimento",
      conteudo: resultado.summary,
      origem: agenteId,
      confianca: resultado.confidence >= 0.75 ? "high" : resultado.confidence >= 0.4 ? "medium" : "low",
      mission_id: missionId ?? null,
    });
  }

  return resultado;
}
