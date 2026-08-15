import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt, type AgenteId } from "./prompts/index.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    },
    required: ["status", "summary", "confidence"],
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

// Executa um especialista (design, trafego, estrategia...) para uma etapa de
// missão e devolve resultado estruturado, sempre validado por schema — ver
// docs/manus-jarvis-spec/docs/03-arquitetura-tecnica.md §3. Genérico: funciona
// para qualquer AgenteId, não é hand-coded por agente.
export async function executarEspecialista(
  agenteId: AgenteId,
  contexto: ContextoMissaoParaEspecialista,
  missionStepId: string,
  clienteId: string,
): Promise<AgentResult> {
  const systemPrompt = `${getSystemPrompt(agenteId)}\n\n${montarContexto(contexto)}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: contexto.etapaTarefa }],
    tools: [ENTREGAR_RESULTADO_TOOL],
    tool_choice: { type: "tool", name: "entregar_resultado" },
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "entregar_resultado",
  );

  const bruto = (toolUse?.input ?? {}) as Partial<AgentResult>;
  const resultado: AgentResult = {
    status: bruto.status ?? "failed",
    summary: bruto.summary ?? "O especialista não retornou um resumo.",
    confidence: typeof bruto.confidence === "number" ? bruto.confidence : 0,
    assumptions: bruto.assumptions ?? [],
    evidence: bruto.evidence ?? [],
    proposedActions: bruto.proposedActions ?? [],
    structuredOutput: (bruto.structuredOutput as Record<string, unknown>) ?? null,
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

  return resultado;
}
