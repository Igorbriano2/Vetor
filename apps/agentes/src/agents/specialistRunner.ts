import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt, type AgenteId } from "./prompts/index.js";
import { gerarVideoAPartirDeImagem, VideoIndisponivelError } from "../integrations/higgsfield.js";
import { gerarImagem, ImagemIndisponivelError } from "../integrations/imageProvider.js";
import { persistirArtefato, type ArtefatoPersistido, type ArtifactType } from "../artifacts/artifactsService.js";
import { selecionarSkills, carregarSkillsSelecionadas, listarTodosOsManifestos } from "../skills/registry.js";
import type { SkillDefinition, SkillDepartment } from "../skills/types.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tipos de artefato que um especialista sem ferramenta de geração conectada
// pode produzir sozinho — sempre texto (documento/copy/plano/relatório).
// "image" e "video" só existem quando vieram de uma ferramenta de execução
// real (ver rodarComFerramentaDeExecucao) — nunca aceitos do que o LLM alega
// ter feito.
const TIPOS_ARTEFATO_TEXTO = ["copy", "document", "plan", "report"] as const;

// Contrato de saída — espelha AgentResult<T> de
// docs/manus-jarvis-spec/docs/04-agentes-e-prompts.md §2. Forçado via
// tool_choice para nunca sair como prosa livre.
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
          "real (ex: gerar_imagem, gerar_video_higgsfield); dizer 'arte criada' sem isso é proibido.",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...TIPOS_ARTEFATO_TEXTO] },
            title: { type: "string" },
            content: { type: "string", description: "O conteúdo de verdade — o texto do briefing/copy/plano/relatório, não um resumo dele." },
            periodo: { type: "string", description: "Só pra type=plan — período do planejamento, formato AAAA-MM (ex: '2026-08')." },
            calendario: {
              type: "array",
              description: "Só pra type=plan — calendário editorial real, um item por peça/ação planejada.",
              items: {
                type: "object",
                properties: {
                  data: { type: "string", description: "AAAA-MM-DD" },
                  titulo: { type: "string" },
                  canal: { type: "string" },
                  tipo: { type: "string" },
                },
                required: ["data", "titulo"],
              },
            },
            indicadores: {
              type: "array",
              description: "Só pra type=plan — indicadores sugeridos pra acompanhar o período.",
              items: { type: "string" },
            },
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

const GERAR_IMAGEM_TOOL: Anthropic.Tool = {
  name: "gerar_imagem",
  description: "Gera a peça visual final a partir de uma descrição de texto (provider de imagem configurado no sistema).",
  input_schema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Descrição visual completa: composição, cores, texto na peça, estilo." },
      aspect_ratio: { type: "string", description: "Ex: '1:1' (feed), '9:16' (story/reel), '4:5'. Default 1:1." },
    },
    required: ["prompt"],
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
  missaoTitulo: string;
  missaoObjetivo: string;
  missaoHipotese: string | null;
  etapaTarefa: string;
  negocio: {
    nomeEmpresa: string;
    nicho: string;
    perfil?: { descricao: string | null; tom: string | null; ofertas: unknown; publico: unknown } | null;
    brandKit?: { cores: unknown; fontes: unknown; regras: unknown } | null;
    assetsDisponiveis?: Array<{ nome: string; url: string; tags: string[] }>;
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

// O que uma ferramenta de execução real devolve: OU uma URL externa
// hospedada pelo provider (vídeo, Higgsfield) OU um arquivo já baixado e
// salvo no nosso bucket (imagem, OpenAI) — nunca os dois. storagePath deixa
// a Vetor dona do arquivo (URL assinada renovável), diferente de externalUrl
// que expira junto com o link do provider.
interface MidiaExecutada {
  requestId: string;
  url?: string;
  storagePath?: string;
  mimeType?: string;
}

interface ContextoExecucaoFerramenta {
  clienteId: string;
  missionStepId: string;
}

// Agentes com uma ferramenta de execução real (geram custo por chamada,
// nunca chamadas em loop irrestrito) além de entregar_resultado.
const FERRAMENTA_GERACAO_POR_AGENTE: Partial<
  Record<
    AgenteId,
    {
      tool: Anthropic.Tool;
      tipo: Extract<ArtifactType, "image" | "video">;
      titulo: string;
      mimeType: string;
      executar: (input: Record<string, unknown>, ctx: ContextoExecucaoFerramenta) => Promise<MidiaExecutada>;
    }
  >
> = {
  video: {
    tool: GERAR_VIDEO_TOOL,
    tipo: "video",
    titulo: "Vídeo gerado (Higgsfield)",
    mimeType: "video/mp4",
    executar: async (input) => {
      try {
        const midia = await gerarVideoAPartirDeImagem(input.imagem_url as string, input.prompt as string);
        return { requestId: midia.requestId, url: midia.url };
      } catch (err) {
        throw err instanceof VideoIndisponivelError ? err : new VideoIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
      }
    },
  },
  design: {
    tool: GERAR_IMAGEM_TOOL,
    tipo: "image",
    titulo: "Imagem gerada",
    mimeType: "image/png",
    executar: async (input, ctx) => {
      try {
        const imagem = await gerarImagem(input.prompt as string, { aspectRatio: input.aspect_ratio as string | undefined });
        const requestId = randomUUID();
        const path = `${ctx.clienteId}/design/${ctx.missionStepId}/${requestId}.png`;
        const { error } = await supabase.storage
          .from("artifacts")
          .upload(path, imagem.bytes, { contentType: imagem.mimeType, upsert: false });
        if (error) throw new Error(`Falha ao salvar imagem gerada no storage: ${error.message}`);
        return { requestId, storagePath: path, mimeType: imagem.mimeType };
      } catch (err) {
        throw err instanceof ImagemIndisponivelError ? err : new ImagemIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
      }
    },
  },
};

// Departamento de skill por agente — só agentes já com skills reais
// registradas entram aqui (rodada a rodada, por departamento; ver
// apps/agentes/src/skills/README.md). Um agente sem entrada aqui roda
// normalmente, sem nenhuma skill anexada.
const DEPARTAMENTO_SKILL_POR_AGENTE: Partial<Record<AgenteId, SkillDepartment>> = {
  estrategia: "strategy",
  "social-media": "social",
};

// Seleciona (por trigger) e carrega no máximo 1 skill pra etapa atual —
// nunca o catálogo inteiro do departamento (carregamento progressivo,
// princípio 8 do Skill Registry). Sem match, o especialista roda só com o
// prompt base, sem skill anexada.
//
// Casa contra título + objetivo + hipótese da missão, não só a tarefa
// granular da etapa: o texto da etapa (gerado pelo Vetor ao propor o plano,
// ex: "cruzar dados coletados com benchmarks...") raramente repete a mesma
// palavra que o cliente usou (ex: "diagnóstico") — testado ao vivo numa
// missão real de diagnóstico onde a etapa sozinha não batia com nenhum
// trigger, mas o título da missão batia direto.
function selecionarESkillDaEtapa(agenteId: AgenteId, contexto: ContextoMissaoParaEspecialista): SkillDefinition | null {
  const department = DEPARTAMENTO_SKILL_POR_AGENTE[agenteId];
  if (!department) return null;

  const textoParaCasar = [contexto.missaoTitulo, contexto.missaoObjetivo, contexto.missaoHipotese, contexto.etapaTarefa]
    .filter(Boolean)
    .join(" ");

  const candidatas = selecionarSkills(department, textoParaCasar);
  // Diagnóstico temporário — achado em produção que nenhuma skill de
  // Estratégia estava sendo selecionada mesmo com trigger óbvio no título da
  // missão; precisa distinguir "nenhum manifesto carregado" (problema de
  // path/build) de "carregou mas não casou nenhum trigger" (problema de
  // seleção) antes de decidir o que corrigir.
  if (candidatas.length === 0) {
    console.log(
      `[skills] nenhuma skill casou pra "${department}" — manifestos disponíveis: ${listarTodosOsManifestos()
        .filter((m) => m.department === department)
        .map((m) => m.id)
        .join(", ") || "(nenhum)"}; texto: "${textoParaCasar.slice(0, 200)}"`,
    );
    return null;
  }

  const [carregada] = carregarSkillsSelecionadas([candidatas[0].id]);
  return carregada ?? null;
}

function montarContexto(ctx: ContextoMissaoParaEspecialista): string {
  const partes = [
    `MISSÃO — objetivo: ${ctx.missaoObjetivo}`,
    ctx.missaoHipotese ? `Hipótese: ${ctx.missaoHipotese}` : null,
    `SUA ETAPA: ${ctx.etapaTarefa}`,
    `NEGÓCIO: ${ctx.negocio.nomeEmpresa} (nicho: ${ctx.negocio.nicho})`,
    ctx.negocio.perfil?.descricao ? `Perfil de negócio: ${ctx.negocio.perfil.descricao}` : null,
    ctx.negocio.perfil?.tom ? `Tom de voz: ${ctx.negocio.perfil.tom}` : null,
    ctx.negocio.brandKit ? `Brand kit atual: ${JSON.stringify(ctx.negocio.brandKit)}` : null,
    ctx.negocio.assetsDisponiveis?.length
      ? `Banco de imagens disponível (use como referência quando fizer sentido): ${ctx.negocio.assetsDisponiveis
          .map((a) => `${a.nome} [${a.tags.join(", ")}] — ${a.url}`)
          .join("; ")}`
      : null,
  ].filter(Boolean);

  return partes.join("\n");
}

interface ResultadoTurnoExecucao {
  message: Anthropic.Message;
  midiaGerada?: MidiaExecutada;
}

// Loop curto e limitado (máx. 3 idas e voltas) pro único tipo de agente que
// tem uma ferramenta de execução real além de entregar_resultado: deixa o
// modelo pedir a geração, executa de verdade, devolve o resultado real como
// tool_result, e força entregar_resultado se ele não fechar sozinho depois
// de ter a mídia em mãos (nunca deixa rodar indefinidamente).
async function rodarComFerramentaDeExecucao(
  systemPrompt: string,
  tarefa: string,
  ferramenta: NonNullable<(typeof FERRAMENTA_GERACAO_POR_AGENTE)[AgenteId]>,
  ctx: ContextoExecucaoFerramenta,
): Promise<ResultadoTurnoExecucao> {
  const mensagens: Anthropic.MessageParam[] = [{ role: "user", content: tarefa }];
  let midiaGerada: ResultadoTurnoExecucao["midiaGerada"];

  for (let turno = 0; turno < 3; turno++) {
    const ultimoTurno = turno === 2;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: mensagens,
      tools: [ENTREGAR_RESULTADO_TOOL, ferramenta.tool],
      tool_choice: ultimoTurno ? { type: "tool", name: "entregar_resultado" } : { type: "auto" },
    });

    const chamada = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === ferramenta.tool.name,
    );
    if (!chamada) return { message: response, midiaGerada };

    mensagens.push({ role: "assistant", content: response.content });

    let resultadoFerramenta: string;
    try {
      const midia = await ferramenta.executar(chamada.input as Record<string, unknown>, ctx);
      midiaGerada = midia;
      resultadoFerramenta = JSON.stringify({
        status: "completed",
        request_id: midia.requestId,
        ...(midia.url ? { url: midia.url } : { armazenado: true }),
      });
    } catch (err) {
      resultadoFerramenta = JSON.stringify({ status: "failed", error: err instanceof Error ? err.message : "erro desconhecido" });
    }

    mensagens.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: chamada.id, content: resultadoFerramenta }],
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
  return { message: response, midiaGerada };
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
  const skillSelecionada = selecionarESkillDaEtapa(agenteId, contexto);
  const blocoSkill = skillSelecionada
    ? `\n\nSKILL SELECIONADA: ${skillSelecionada.manifest.name} (${skillSelecionada.manifest.id} v${skillSelecionada.manifest.version})\n${skillSelecionada.instructions}`
    : "";
  // Log de auditoria mínimo — SkillRun (types.ts) ainda não tem tabela
  // própria (gap conhecido, próxima rodada); por ora a seleção fica
  // rastreável via log em vez de silenciosamente não registrada em lugar
  // nenhum.
  if (skillSelecionada) {
    console.log(
      `[skills] etapa ${missionStepId} (${agenteId}) usou a skill "${skillSelecionada.manifest.id}" v${skillSelecionada.manifest.version}`,
    );
  }
  const systemPrompt = `${getSystemPrompt(agenteId)}\n\n${montarContexto(contexto)}${blocoSkill}`;
  const departamento = DEPARTAMENTO_POR_AGENTE[agenteId];
  const ferramentaGeracao = FERRAMENTA_GERACAO_POR_AGENTE[agenteId];

  let response: Anthropic.Message;
  let midiaGerada: ResultadoTurnoExecucao["midiaGerada"];

  if (ferramentaGeracao) {
    const resultadoExecucao = await rodarComFerramentaDeExecucao(systemPrompt, contexto.etapaTarefa, ferramentaGeracao, {
      clienteId,
      missionStepId,
    });
    response = resultadoExecucao.message;
    midiaGerada = resultadoExecucao.midiaGerada;
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
    periodo?: string;
    calendario?: Array<{ data: string; titulo: string; canal?: string; tipo?: string }>;
    indicadores?: string[];
  }
  const bruto = (toolUse?.input ?? {}) as Partial<AgentResult> & { artifacts?: ArtefatoBruto[] };

  const artefatosPersistidos: ArtefatoPersistido[] = [];

  // Mídia real gerada pela ferramenta de execução — sempre um artefato real,
  // independente do que o modelo tenha dito em `artifacts` (que só aceita
  // tipos de texto, ver TIPOS_ARTEFATO_TEXTO).
  if (midiaGerada && ferramentaGeracao) {
    try {
      artefatosPersistidos.push(
        await persistirArtefato({
          clienteId,
          missionId,
          missionStepId,
          type: ferramentaGeracao.tipo,
          department: departamento,
          title: ferramentaGeracao.titulo,
          ...(midiaGerada.storagePath ? { storagePath: midiaGerada.storagePath } : { externalUrl: midiaGerada.url }),
          mimeType: midiaGerada.mimeType ?? ferramentaGeracao.mimeType,
          criadoPorAgente: agenteId,
        }),
      );
    } catch (err) {
      console.warn(`Falha ao persistir artefato de mídia da etapa ${missionStepId}:`, err instanceof Error ? err.message : err);
    }
  }

  // Artefatos de texto declarados pelo modelo — só os tipos permitidos no
  // schema chegam aqui, mas revalida no código mesmo assim (nunca confiar só
  // no schema da API de tool use).
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
          metadataExtra:
            item.type === "plan"
              ? { periodo: item.periodo, calendario: item.calendario ?? [], indicadores: item.indicadores ?? [] }
              : undefined,
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
