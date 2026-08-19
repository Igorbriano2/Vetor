import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt, type AgenteId } from "./prompts/index.js";
import { gerarVideoAPartirDeImagem, VideoIndisponivelError } from "../integrations/higgsfield.js";
import { gerarProxyDeVideo } from "../integrations/renderService.js";
import { gerarPerfilDeVideoDeReferencia } from "../negocio/referenceVideoAnalysis.js";
import { gerarImagem, gerarImagemComReferencia, ImagemIndisponivelError, tamanhoOpenAI, type ReferenciaImagem } from "../integrations/imageProvider.js";
import {
  dimensaoDoTamanhoOpenAI,
  lerDimensaoDeImagem,
  montarCanvasJsonInicial,
  criarDesignProject,
  buscarReferenciasAprovadas,
} from "../negocio/designProjects.js";
import { avaliarPecaDeDesign, type DesignCriticResultado } from "../negocio/designCritic.js";
import { buscarOuCriarVideoProjectRascunho, montarTimelineInicial, atualizarTimelineDoVideoProject } from "../negocio/videoProjects.js";
import { executarEstagioIdempotente } from "../negocio/videoPipeline.js";
import { persistirArtefato, type ArtefatoPersistido, type ArtifactType } from "../artifacts/artifactsService.js";
import { selecionarSkills, carregarSkillsSelecionadas, listarTodosOsManifestos } from "../skills/registry.js";
import type { SkillDefinition, SkillDepartment } from "../skills/types.js";
import {
  buscarLogoParaFormato,
  validarAtivoParaUso,
  baixarBytesDoAtivo,
  buscarAtivoPorId,
  registrarUsoDeAtivo,
  type AssetDisponivel,
} from "../negocio/businessAssets.js";

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

const EDITAR_VIDEO_TIMELINE_TOOL: Anthropic.Tool = {
  name: "editar_video_timeline",
  description:
    "Inicia (ou retoma) o projeto de edição não destrutiva pra um vídeo REAL já enviado pelo cliente (asset_id do " +
    "Drive) — gera um proxy leve de edição e monta a timeline editável inicial com o arquivo real. Use isso, NUNCA " +
    "gerar_video_higgsfield, quando o cliente anexou um arquivo de vídeo pra EDITAR (cortar, legendar, tirar " +
    "silêncio, etc.). gerar_video_higgsfield é só pra gerar um vídeo NOVO a partir de uma imagem parada — nunca use " +
    "as duas ferramentas na mesma etapa.",
  input_schema: {
    type: "object",
    properties: {
      asset_id: {
        type: "string",
        description: "Id do ativo de vídeo (Drive, lista 'Banco de ativos disponível' no contexto) enviado pelo cliente pra editar.",
      },
    },
    required: ["asset_id"],
  },
};

const ANALISAR_VIDEO_REFERENCIA_TOOL: Anthropic.Tool = {
  name: "analisar_video_de_referencia",
  description:
    "Analisa um vídeo de referência REAL anexado pelo cliente (concorrente, vídeo viral, exemplo de estilo desejado) e " +
    "extrai um perfil de estilo (ritmo de corte, energia musical, estrutura de abertura, estilo de legenda, paleta) pra " +
    "orientar as próximas edições nesse mesmo estilo. Use isso quando o cliente pedir pra editar/gerar algo 'no estilo " +
    "deste vídeo' ou 'parecido com este'. Nunca copia o conteúdo do vídeo de referência, só o PERFIL dele.",
  input_schema: {
    type: "object",
    properties: {
      asset_id: {
        type: "string",
        description: "Id do ativo de vídeo (Drive, lista 'Banco de ativos disponível' no contexto) a ser analisado como referência.",
      },
    },
    required: ["asset_id"],
  },
};

const GERAR_IMAGEM_TOOL: Anthropic.Tool = {
  name: "gerar_imagem",
  description:
    "Gera a peça visual final a partir de uma descrição de texto (provider de imagem configurado no sistema). " +
    "Quando o negócio tiver ativos reais cadastrados no Drive relevantes pra esta peça (produto, pessoa, ambiente " +
    "mencionado, ou logo oficial), sempre passe os IDs deles em asset_ids — a peça é composta a partir do arquivo " +
    "real (image-to-image), não desenhada de memória a partir de descrição.",
  input_schema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Descrição visual completa: composição, cores, texto na peça, estilo." },
      aspect_ratio: { type: "string", description: "Ex: '1:1' (feed), '9:16' (story/reel), '4:5'. Default 1:1." },
      formato: {
        type: "string",
        enum: ["feed", "story", "avatar", "generico"],
        description: "Canal de destino — decide qual variante da logo oficial usar (ver Brand Kit no contexto).",
      },
      asset_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "IDs (da lista 'Banco de ativos disponível' no contexto) de produto/pessoa/ambiente/referência real a " +
          "incorporar na peça. Nunca invente um id — só use os que apareceram na lista.",
      },
    },
    required: ["prompt"],
  },
};

export interface AssetSelectionItem {
  assetId: string;
  papel: "referencia" | "fonte" | "logo" | "template" | "fundo" | "produto" | "pessoa";
  motivo: string;
  obrigatorio: boolean;
}

export interface AssetSelection {
  selectedAssets: AssetSelectionItem[];
  missingAssets: string[];
  logoAssetId?: string;
  generationMode: "asset_based" | "generated" | "hybrid";
}

export interface BrandValidation {
  passed: boolean;
  issues: string[];
}

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
  // Preenchidos só pelo agente de Design (Drive de ativos) — opcionais pros
  // demais agentes, nunca quebram o contrato compartilhado.
  sourceAssetIds?: string[];
  logoAssetId?: string;
  assetSelection?: AssetSelection;
  brandValidation?: BrandValidation;
  // Preenchidos só pelo agente de Design quando a geração vira uma camada
  // editável (Parte 1 da evolução de Design/Vídeo) — o design_project
  // criado a partir da imagem gerada. Ausentes quando a criação do
  // design_project falha (nunca bloqueia a entrega do artifact PNG por
  // causa disso, ver executarEspecialista).
  designProjectId?: string;
  canvasJson?: unknown;
  version?: number;
  designBrief?: string;
  // Veredito do DesignCritic (ver designCritic.ts) — quando passed=false,
  // `status` acima nunca fica "completed" mesmo que o próprio LLM tenha
  // dito isso (ver executarEspecialista): a etapa vira needs_clarification
  // com os issues do critic anexados, pra aprovação humana ver exatamente
  // o que precisa de revisão em vez de um "concluído" que não é de verdade.
  designCritic?: DesignCriticResultado;
  // Peças já aprovadas do MESMO tenant mostradas ao Design como inspiração
  // de composição/ritmo/hierarquia/tratamento/formato — nunca cópia
  // literal (ver buscarReferenciasAprovadas em designProjects.ts). Vazio
  // quando é a primeira peça do cliente ou nenhuma outra está aprovada
  // ainda.
  approvedReferenceIds?: string[];
  // Preenchidos só pelo agente de Vídeo quando editar_video_timeline roda
  // (Parte 2/4) — o video_project criado a partir do arquivo real enviado
  // pelo cliente. Nunca um MP4 opaco só: a timeline editável É a entrega,
  // o render final (quando existir) é sempre derivado dela.
  videoProjectId?: string;
  videoTimelineJson?: unknown;
  videoTimelineVersion?: number;
  videoDurationMs?: number;
  // Preenchido só pelo agente de Vídeo quando analisar_video_de_referencia
  // roda (Parte 3) — o perfil de estilo derivado do vídeo de referência
  // real, já persistido em reference_video_profiles.
  referenceVideoProfileId?: string;
  referenceVideoProfile?: Record<string, unknown>;
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
    brandKit?: {
      cores: unknown;
      fontes: unknown;
      regras: unknown;
      logo_area_protecao?: string | null;
      logo_tamanho_minimo?: string | null;
      logo_fundos_proibidos?: unknown;
      logo_usos_proibidos?: unknown;
    } | null;
    assetsDisponiveis?: AssetDisponivel[];
  };
  // Preenchido só pro agente de Tráfego/Analítico — dado real sincronizado do
  // Meta Ads (metaAdsSync.ts), nunca inventado. Ausência de conexão vira lista
  // vazia + ultimaAnalise null, nunca métrica fictícia.
  trafego?: {
    contaConectada: boolean;
    campanhas: Array<{
      nome: string;
      status: string;
      orcamentoCentavos: number | null;
      tetoCustoResultadoCentavos: number | null;
      metricas: unknown;
    }>;
    ultimaAnalise: { data: string; diagnostico: string | null; metricasUsadas: unknown } | null;
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
  sourceAssetIds?: string[];
  logoAssetId?: string;
  brandValidation?: BrandValidation;
  // Preenchido só pelo agente de Design — dados reais pra montar o
  // canvasJson do design_project (Parte 1). Nunca inferido: dimensão vem
  // do mesmo mapeamento usado pra pedir a imagem ao provider
  // (tamanhoOpenAI), logo vem do asset real já resolvido em
  // buscarLogoParaFormato().
  canvasInfo?: {
    width: number;
    height: number;
    logo?: { assetId: string; storagePath: string; naturalWidth: number | null; naturalHeight: number | null };
  };
  // O prompt de verdade usado pra gerar a imagem — vira o designBrief do
  // design_project (nunca reconstruído a partir do summary do LLM, que pode
  // divergir do que foi realmente pedido ao provider).
  promptUsado?: string;
  // Veredito do DesignCritic sobre a peça gerada — ver designCritic.ts.
  // Preenchido só pra Design; usado tanto pra gravar no design_project
  // quanto pra decidir se a etapa pode mesmo fechar como "completed".
  designCritic?: DesignCriticResultado;
  // Preenchido só por editar_video_timeline — o video_project já criado
  // (ou reaproveitado, se a etapa está sendo repetida) com a timeline
  // real montada. Diferente de storagePath/url: não existe um arquivo
  // único gerado aqui, o resultado É o projeto editável.
  videoProjectCriado?: { id: string; timelineVersion: number; timelineJson: unknown; durationMs: number };
  // Preenchido só por analisar_video_de_referencia — o perfil já persistido
  // (não existe arquivo derivado aqui, o resultado É o perfil).
  referenceVideoProfileCriado?: { id: string; perfil: Record<string, unknown> };
}

interface ContextoExecucaoFerramenta {
  clienteId: string;
  missionId?: string;
  missionStepId: string;
  // Repassado só pro Design avaliar aderência ao BrandKit no DesignCritic —
  // mesmo shape já usado em ContextoMissaoParaEspecialista.negocio.brandKit.
  brandKit?: ContextoMissaoParaEspecialista["negocio"]["brandKit"];
}

function inferirFormatoPeloAspectRatio(aspectRatio?: string): "feed" | "story" | "avatar" | "generico" {
  if (aspectRatio === "9:16") return "story";
  if (aspectRatio === "1:1") return "feed";
  return "generico";
}

// Agentes com uma ferramenta de execução real (geram custo por chamada,
// nunca chamadas em loop irrestrito) além de entregar_resultado.
interface FerramentaDeExecucao {
  tool: Anthropic.Tool;
  tipo: Extract<ArtifactType, "image" | "video">;
  titulo: string;
  mimeType: string;
  // false pra ferramentas cujo resultado não é um arquivo único genérico
  // pra persistir como artifact — ex: editar_video_timeline, cujo
  // resultado É o video_project (a timeline editável), não um arquivo
  // solto (ver bloco de persistência em executarEspecialista).
  criaArtefatoGenerico: boolean;
  executar: (input: Record<string, unknown>, ctx: ContextoExecucaoFerramenta) => Promise<MidiaExecutada>;
}

// Cada agente pode ter MAIS DE UMA ferramenta de execução real (ex: Vídeo
// tem gerar_video_higgsfield E editar_video_timeline — são dois caminhos
// bem diferentes, geração vs. edição não destrutiva de um arquivo real —
// o LLM escolhe qual usar por etapa, nunca as duas juntas).
const FERRAMENTA_GERACAO_POR_AGENTE: Partial<Record<AgenteId, FerramentaDeExecucao[]>> = {
  video: [
    {
      tool: GERAR_VIDEO_TOOL,
      tipo: "video",
      titulo: "Vídeo gerado (Higgsfield)",
      mimeType: "video/mp4",
      criaArtefatoGenerico: true,
      executar: async (input) => {
        try {
          const midia = await gerarVideoAPartirDeImagem(input.imagem_url as string, input.prompt as string);
          return { requestId: midia.requestId, url: midia.url };
        } catch (err) {
          throw err instanceof VideoIndisponivelError ? err : new VideoIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
        }
      },
    },
    {
      tool: EDITAR_VIDEO_TIMELINE_TOOL,
      tipo: "video",
      titulo: "Projeto de vídeo em edição",
      mimeType: "video/mp4",
      criaArtefatoGenerico: false,
      executar: async (input, ctx) => {
        const assetId = input.asset_id as string;
        const validacao = await validarAtivoParaUso(ctx.clienteId, assetId);
        if (!validacao.valido) throw new Error(`Ativo inválido pra edição: ${validacao.motivo}`);

        const asset = await buscarAtivoPorId(assetId);
        if (!asset) throw new Error("Ativo de vídeo não encontrado.");

        // Palpite honesto de formato (retrato) quando o ativo ainda não
        // tem width/height gravado (uploads antigos) — nunca bloqueia a
        // edição por falta dessa metadata, só usa um padrão razoável.
        const largura = asset.width ?? 1080;
        const altura = asset.height ?? 1920;

        const { id: videoProjectId, timelineVersion } = await buscarOuCriarVideoProjectRascunho({
          clienteId: ctx.clienteId,
          missionId: ctx.missionId,
          missionStepId: ctx.missionStepId,
          title: "Vídeo em edição",
          width: largura,
          height: altura,
          fps: 30,
        });

        // Estágio "proxy" — idempotente: se a etapa já rodou isso antes
        // (retry), reaproveita o resultado salvo em vez de gerar de novo.
        const proxy = await executarEstagioIdempotente(videoProjectId, ctx.clienteId, "proxy", () =>
          gerarProxyDeVideo({ bucket: "brand-assets", storagePath: asset.storagePath, clienteId: ctx.clienteId }),
        );

        // Estágio "timeline_draft" — idempotente também, e só roda depois
        // do proxy real (precisa da duração real do arquivo).
        const timelineResultado = await executarEstagioIdempotente(videoProjectId, ctx.clienteId, "timeline_draft", async () => {
          const timelineJson = montarTimelineInicial({
            sourceAssetId: assetId,
            durationMs: proxy.durationMs,
            width: largura,
            height: altura,
            fps: 30,
          });
          await atualizarTimelineDoVideoProject(videoProjectId, timelineJson, proxy.durationMs, proxy.storagePath);
          return { timelineJson };
        });

        await registrarUsoDeAtivo({
          clienteId: ctx.clienteId,
          assetId,
          missionId: ctx.missionId,
          missionStepId: ctx.missionStepId,
          agente: "video",
          papel: "fonte",
          motivo: "Arquivo de origem enviado pelo cliente pra edição não destrutiva.",
        });

        return {
          requestId: videoProjectId,
          sourceAssetIds: [assetId],
          videoProjectCriado: {
            id: videoProjectId,
            timelineVersion,
            timelineJson: timelineResultado.timelineJson,
            durationMs: proxy.durationMs,
          },
        };
      },
    },
    {
      tool: ANALISAR_VIDEO_REFERENCIA_TOOL,
      tipo: "video",
      titulo: "Perfil de vídeo de referência",
      mimeType: "application/json",
      criaArtefatoGenerico: false,
      executar: async (input, ctx) => {
        const assetId = input.asset_id as string;
        const perfil = await gerarPerfilDeVideoDeReferencia({ clienteId: ctx.clienteId, assetId });

        await registrarUsoDeAtivo({
          clienteId: ctx.clienteId,
          assetId,
          missionId: ctx.missionId,
          missionStepId: ctx.missionStepId,
          agente: "video",
          papel: "referencia",
          motivo: "Vídeo de referência analisado pra derivar perfil de estilo.",
        });

        return {
          requestId: perfil.id,
          sourceAssetIds: [assetId],
          referenceVideoProfileCriado: { id: perfil.id, perfil: perfil as unknown as Record<string, unknown> },
        };
      },
    },
  ],
  design: [
    {
      tool: GERAR_IMAGEM_TOOL,
      tipo: "image",
      titulo: "Imagem gerada",
      mimeType: "image/png",
      criaArtefatoGenerico: true,
      executar: async (input, ctx) => {
      try {
        const prompt = input.prompt as string;
        const aspectRatio = input.aspect_ratio as string | undefined;
        const formato = (input.formato as "feed" | "story" | "avatar" | "generico" | undefined) ?? inferirFormatoPeloAspectRatio(aspectRatio);
        const assetIdsPedidos = Array.isArray(input.asset_ids) ? (input.asset_ids as string[]).filter((id) => typeof id === "string") : [];

        const referencias: ReferenciaImagem[] = [];
        const sourceAssetIds: string[] = [];
        const issues: string[] = [];
        let logoAssetId: string | undefined;
        // Dimensão real decodificada dos bytes baixados — nunca a coluna
        // business_assets.width/height (achado ao vivo: ativos antigos têm
        // essa coluna nula, e um fallback aqui forçaria a logo pra uma
        // caixa quadrada, distorcendo ela no canvas).
        let logoDimensaoReal: { width: number; height: number } | null = null;

        // Regra inegociável: se existe logo oficial cadastrada pro formato,
        // ela É incorporada (image-to-image real) — nunca opcional quando
        // disponível. Falha em baixar o arquivo é bloqueante (ver
        // brandValidation abaixo), diferente de simplesmente não ter logo
        // cadastrada (permitido, só fica marcado como pendente).
        const logo = await buscarLogoParaFormato(ctx.clienteId, formato);
        if (logo) {
          const bytesLogo = await baixarBytesDoAtivo(logo.id);
          if (bytesLogo) {
            referencias.push({ bytes: bytesLogo, mimeType: "image/png", nome: "logo-oficial.png" });
            sourceAssetIds.push(logo.id);
            logoAssetId = logo.id;
            logoDimensaoReal = lerDimensaoDeImagem(bytesLogo);
            await registrarUsoDeAtivo({
              clienteId: ctx.clienteId,
              assetId: logo.id,
              missionId: ctx.missionId,
              missionStepId: ctx.missionStepId,
              agente: "design",
              papel: "logo",
              motivo: `Logo oficial aplicada (formato: ${formato}).`,
            });
          } else {
            issues.push("Logo oficial está cadastrada, mas o arquivo não pôde ser baixado do storage — peça bloqueada até corrigir o ativo.");
          }
        }

        // asset_ids pedidos pelo modelo (produto/pessoa/ambiente/referência)
        // — nunca confia cegamente: revalida tenant + status aprovado antes
        // de baixar qualquer coisa. Ignora se o modelo pediu de novo o
        // mesmo id da logo já aplicada acima (achado ao vivo: o prompt
        // instrui "sempre passe os ids relevantes, incluindo a logo" e o
        // contexto já lista a logo — sem isso duplicava a referência
        // enviada ao provider e o source_asset_ids do design_project).
        for (const assetId of assetIdsPedidos) {
          if (assetId === logoAssetId) continue;
          const validacao = await validarAtivoParaUso(ctx.clienteId, assetId);
          if (!validacao.valido) continue;
          const bytes = await baixarBytesDoAtivo(assetId);
          if (!bytes) continue;
          referencias.push({ bytes, mimeType: "image/png", nome: `ref-${assetId}.png` });
          sourceAssetIds.push(assetId);
          await registrarUsoDeAtivo({
            clienteId: ctx.clienteId,
            assetId,
            missionId: ctx.missionId,
            missionStepId: ctx.missionStepId,
            agente: "design",
            papel: "referencia",
            motivo: "Selecionado pelo agente como referência visual real pra esta peça.",
          });
        }

        const imagem =
          referencias.length > 0
            ? await gerarImagemComReferencia(prompt, referencias, { aspectRatio })
            : await gerarImagem(prompt, { aspectRatio });

        const requestId = randomUUID();
        const path = `${ctx.clienteId}/design/${ctx.missionStepId}/${requestId}.png`;
        const { error } = await supabase.storage
          .from("artifacts")
          .upload(path, imagem.bytes, { contentType: imagem.mimeType, upsert: false });
        if (error) throw new Error(`Falha ao salvar imagem gerada no storage: ${error.message}`);

        const { width, height } = dimensaoDoTamanhoOpenAI(tamanhoOpenAI(aspectRatio));

        // DesignCritic — verificação com visão real antes da etapa poder
        // fechar como concluída (critério de aceite da spec). Roda sempre
        // que a peça foi gerada, nunca é pulado por "confiança" do LLM.
        const designCritic = await avaliarPecaDeDesign({
          imagemBytes: imagem.bytes,
          mimeType: imagem.mimeType,
          briefOriginal: prompt,
          formato,
          brandKit: ctx.brandKit,
          logoDeveriaEstarAplicada: !!logoAssetId,
        });

        return {
          requestId,
          storagePath: path,
          mimeType: imagem.mimeType,
          sourceAssetIds,
          logoAssetId,
          brandValidation: { passed: issues.length === 0, issues },
          designCritic,
          canvasInfo: {
            width,
            height,
            // Só adiciona o objeto travado de logo no canvas quando a
            // dimensão real foi decodificada dos bytes — sem isso, a caixa
            // cairia num fallback quadrado e distorceria a logo (proibido
            // pela spec). A logo ainda assim já foi incorporada na imagem
            // via image-to-image acima, mesmo sem o overlay.
            ...(logo && logoAssetId && logoDimensaoReal
              ? {
                  logo: {
                    assetId: logoAssetId,
                    storagePath: logo.storagePath,
                    naturalWidth: logoDimensaoReal.width,
                    naturalHeight: logoDimensaoReal.height,
                  },
                }
              : {}),
          },
          promptUsado: prompt,
        };
      } catch (err) {
        throw err instanceof ImagemIndisponivelError ? err : new ImagemIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
      }
    },
    },
  ],
};

// Departamento de skill por agente — só agentes já com skills reais
// registradas entram aqui (rodada a rodada, por departamento; ver
// apps/agentes/src/skills/README.md). Um agente sem entrada aqui roda
// normalmente, sem nenhuma skill anexada.
const DEPARTAMENTO_SKILL_POR_AGENTE: Partial<Record<AgenteId, SkillDepartment>> = {
  estrategia: "strategy",
  "social-media": "social",
  design: "design",
  video: "video",
  trafego: "traffic",
  // O Vetor às vezes roteia tarefa de auditoria/análise de tráfego pro
  // agente analítico em vez do agente de tráfego (ex: "faz uma auditoria da
  // conta" vira etapa ANALITICO) — mesmo departamento de skill nos dois,
  // já que buscarContextoTrafego() também é injetado pra analitico.
  analitico: "traffic",
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
      ? `Banco de ativos disponível (Drive real do negócio — SEMPRE consulte antes de gerar; passe os ids relevantes ` +
        `em asset_ids do gerar_imagem, nunca invente que usou um ativo que não está aqui):\n` +
        ctx.negocio.assetsDisponiveis
          .map(
            (a) =>
              `- [id: ${a.id}] ${a.nome}${a.isLogoPrincipal ? " (LOGO)" : ""} (categoria: ${a.categoria})${a.tags.length ? ` [${a.tags.join(", ")}]` : ""}${a.descricao ? ` — ${a.descricao}` : ""}`,
          )
          .join("\n")
      : null,
    ctx.trafego
      ? !ctx.trafego.contaConectada
        ? "TRÁFEGO: nenhuma conta de anúncios conectada — não invente métrica, campanha ou gasto. " +
          "Diga isso claramente e, se a etapa pedir análise, ofereça pedir a conexão da conta em vez de simular dado."
        : `TRÁFEGO (dado real sincronizado do Meta Ads, última análise: ${ctx.trafego.ultimaAnalise?.data ?? "nunca"}):\n` +
          (ctx.trafego.campanhas.length === 0
            ? "- Nenhuma campanha encontrada na conta conectada."
            : ctx.trafego.campanhas
                .map(
                  (c) =>
                    `- ${c.nome} (${c.status})${c.orcamentoCentavos != null ? `, orçamento: R$ ${(c.orcamentoCentavos / 100).toFixed(2)}` : ""}` +
                    `${c.tetoCustoResultadoCentavos != null ? `, teto custo/resultado: R$ ${(c.tetoCustoResultadoCentavos / 100).toFixed(2)}` : ""} — métricas: ${JSON.stringify(c.metricas)}`,
                )
                .join("\n")) +
          (ctx.trafego.ultimaAnalise?.diagnostico ? `\nÚltimo diagnóstico registrado: ${ctx.trafego.ultimaAnalise.diagnostico}` : "")
      : null,
  ].filter(Boolean);

  return partes.join("\n");
}

interface ResultadoTurnoExecucao {
  message: Anthropic.Message;
  midiaGerada?: MidiaExecutada;
  // Qual das ferramentas do agente foi de fato chamada — precisa disso
  // pra saber tipo/titulo/mimeType/criaArtefatoGenerico certos depois
  // (Vídeo agora tem duas ferramentas bem diferentes, ver
  // FERRAMENTA_GERACAO_POR_AGENTE).
  ferramentaUsada?: FerramentaDeExecucao;
}

// Loop curto e limitado (máx. 3 idas e voltas) pros agentes que têm uma ou
// mais ferramentas de execução real além de entregar_resultado: deixa o
// modelo escolher e pedir UMA delas, executa de verdade, devolve o
// resultado real como tool_result, e força entregar_resultado se ele não
// fechar sozinho depois de ter o resultado em mãos (nunca deixa rodar
// indefinidamente).
async function rodarComFerramentaDeExecucao(
  systemPrompt: string,
  tarefa: string,
  ferramentas: FerramentaDeExecucao[],
  ctx: ContextoExecucaoFerramenta,
): Promise<ResultadoTurnoExecucao> {
  const mensagens: Anthropic.MessageParam[] = [{ role: "user", content: tarefa }];
  let midiaGerada: ResultadoTurnoExecucao["midiaGerada"];
  let ferramentaUsada: FerramentaDeExecucao | undefined;
  const nomesFerramentas = new Set(ferramentas.map((f) => f.tool.name));

  for (let turno = 0; turno < 3; turno++) {
    const ultimoTurno = turno === 2;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: mensagens,
      tools: [ENTREGAR_RESULTADO_TOOL, ...ferramentas.map((f) => f.tool)],
      tool_choice: ultimoTurno ? { type: "tool", name: "entregar_resultado" } : { type: "auto" },
    });

    const chamada = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && nomesFerramentas.has(b.name),
    );
    if (!chamada) return { message: response, midiaGerada, ferramentaUsada };

    const ferramenta = ferramentas.find((f) => f.tool.name === chamada.name)!;
    ferramentaUsada = ferramenta;
    mensagens.push({ role: "assistant", content: response.content });

    let resultadoFerramenta: string;
    try {
      const midia = await ferramenta.executar(chamada.input as Record<string, unknown>, ctx);
      midiaGerada = midia;
      resultadoFerramenta = JSON.stringify({
        status: "completed",
        request_id: midia.requestId,
        ...(midia.url ? { url: midia.url } : {}),
        ...(midia.videoProjectCriado ? { video_project_id: midia.videoProjectCriado.id, armazenado: true } : {}),
        ...(midia.referenceVideoProfileCriado
          ? { reference_video_profile_id: midia.referenceVideoProfileCriado.id, perfil: midia.referenceVideoProfileCriado.perfil }
          : {}),
        ...(midia.url || midia.videoProjectCriado || midia.referenceVideoProfileCriado ? {} : { armazenado: true }),
        ...(midia.sourceAssetIds?.length ? { ativos_reais_usados: midia.sourceAssetIds } : {}),
        ...(midia.brandValidation && !midia.brandValidation.passed
          ? { aviso_marca: midia.brandValidation.issues.join(" ") }
          : {}),
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
  return { message: response, midiaGerada, ferramentaUsada };
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
  // Referências aprovadas do mesmo tenant (Parte 1) — só inspiram
  // composição/ritmo/hierarquia/tratamento/formato, nunca viram
  // image-to-image (arriscaria cópia literal de pixels): entram só como
  // descrição textual no prompt, igual uma referência que um diretor de
  // arte humano olharia antes de desenhar algo novo, não decalcaria.
  const referenciasAprovadas = agenteId === "design" ? await buscarReferenciasAprovadas(clienteId) : [];
  const blocoReferencias = referenciasAprovadas.length
    ? `\n\nPEÇAS JÁ APROVADAS DESTE CLIENTE (inspiração de composição/ritmo/hierarquia/tratamento — NUNCA copie literalmente, é referência de estilo, não um template pra reproduzir):\n${referenciasAprovadas
        .map((r) => `- "${r.title}" (${r.width}x${r.height})${r.designBrief ? `: ${r.designBrief.slice(0, 300)}` : ""}`)
        .join("\n")}`
    : "";

  const systemPrompt = `${getSystemPrompt(agenteId)}\n\n${montarContexto(contexto)}${blocoSkill}${blocoReferencias}`;
  const departamento = DEPARTAMENTO_POR_AGENTE[agenteId];
  const ferramentasGeracao = FERRAMENTA_GERACAO_POR_AGENTE[agenteId] ?? [];

  let response: Anthropic.Message;
  let midiaGerada: ResultadoTurnoExecucao["midiaGerada"];
  let ferramentaUsada: FerramentaDeExecucao | undefined;

  if (ferramentasGeracao.length > 0) {
    const resultadoExecucao = await rodarComFerramentaDeExecucao(systemPrompt, contexto.etapaTarefa, ferramentasGeracao, {
      clienteId,
      missionId,
      missionStepId,
      brandKit: contexto.negocio.brandKit,
    });
    response = resultadoExecucao.message;
    midiaGerada = resultadoExecucao.midiaGerada;
    ferramentaUsada = resultadoExecucao.ferramentaUsada;
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
  let designProjectCriado: { id: string; version: number; canvasJson: unknown; designBrief?: string } | undefined;

  // Mídia real gerada pela ferramenta de execução — sempre um artefato real,
  // independente do que o modelo tenha dito em `artifacts` (que só aceita
  // tipos de texto, ver TIPOS_ARTEFATO_TEXTO). Só entra aqui se a
  // ferramenta usada produz um arquivo único genérico — editar_video_
  // timeline não entra (o resultado dela É o video_project, não um
  // arquivo solto, ver criaArtefatoGenerico).
  if (midiaGerada && ferramentaUsada && ferramentaUsada.criaArtefatoGenerico) {
    try {
      const artefato = await persistirArtefato({
        clienteId,
        missionId,
        missionStepId,
        type: ferramentaUsada.tipo,
        department: departamento,
        title: ferramentaUsada.titulo,
        ...(midiaGerada.storagePath ? { storagePath: midiaGerada.storagePath } : { externalUrl: midiaGerada.url }),
        mimeType: midiaGerada.mimeType ?? ferramentaUsada.mimeType,
        criadoPorAgente: agenteId,
      });
      artefatosPersistidos.push(artefato);

      // Design (Parte 1): a entrega nunca é só o PNG — sempre que a geração
      // tem storagePath real (nunca pra vídeo Higgsfield, que só devolve
      // url externa) e dimensão conhecida, cria a camada editável em cima
      // dele. Falha aqui NUNCA derruba a entrega do artifact — fica só sem
      // design_project, e o painel continua mostrando a peça pronta.
      if (agenteId === "design" && midiaGerada.storagePath && midiaGerada.canvasInfo) {
        try {
          const canvasJson = montarCanvasJsonInicial({
            fundo: {
              storagePath: midiaGerada.storagePath,
              bucket: "artifacts",
              naturalWidth: midiaGerada.canvasInfo.width,
              naturalHeight: midiaGerada.canvasInfo.height,
            },
            canvasWidth: midiaGerada.canvasInfo.width,
            canvasHeight: midiaGerada.canvasInfo.height,
            ...(midiaGerada.canvasInfo.logo
              ? {
                  logo: {
                    assetId: midiaGerada.canvasInfo.logo.assetId,
                    storagePath: midiaGerada.canvasInfo.logo.storagePath,
                    naturalWidth: midiaGerada.canvasInfo.logo.naturalWidth ?? undefined,
                    naturalHeight: midiaGerada.canvasInfo.logo.naturalHeight ?? undefined,
                  },
                }
              : {}),
          });

          const criado = await criarDesignProject({
            clienteId,
            missionId,
            missionStepId,
            artifactId: artefato.id,
            title: ferramentaUsada.titulo,
            width: midiaGerada.canvasInfo.width,
            height: midiaGerada.canvasInfo.height,
            canvasJson,
            sourceAssetIds: midiaGerada.sourceAssetIds ?? [],
            logoAssetId: midiaGerada.logoAssetId,
            brandValidation: midiaGerada.brandValidation,
            designBrief: midiaGerada.promptUsado,
            designCritic: midiaGerada.designCritic,
            referenceAssetIds: referenciasAprovadas.map((r) => r.id),
          });

          designProjectCriado = { id: criado.id, version: criado.version, canvasJson, designBrief: midiaGerada.promptUsado };
        } catch (err) {
          console.warn(`Falha ao criar design_project da etapa ${missionStepId}:`, err instanceof Error ? err.message : err);
        }
      }
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

  // DesignCritic reprovou: a etapa NUNCA fecha como "completed" por causa
  // disso, mesmo que o próprio LLM tenha dito que sim — vira
  // needs_clarification com os issues do critic anexados ao summary, pra
  // quem for aprovar ver exatamente o que falta corrigir (nunca um
  // "concluído" que na verdade não passou no checklist de qualidade).
  const criticReprovou = midiaGerada?.designCritic && !midiaGerada.designCritic.passed;
  const statusFinal = criticReprovou && bruto.status === "completed" ? "needs_clarification" : (bruto.status ?? "failed");
  const summaryFinal =
    criticReprovou && midiaGerada?.designCritic
      ? `${bruto.summary ?? ""}\n\nDesignCritic reprovou esta peça: ${midiaGerada.designCritic.resumo}\nProblemas encontrados:\n${midiaGerada.designCritic.issues.map((i) => `- ${i}`).join("\n")}`
      : (bruto.summary ?? "O especialista não retornou um resumo.");

  const resultado: AgentResult = {
    status: statusFinal,
    summary: summaryFinal,
    confidence: typeof bruto.confidence === "number" ? bruto.confidence : 0,
    assumptions: bruto.assumptions ?? [],
    evidence: bruto.evidence ?? [],
    proposedActions: bruto.proposedActions ?? [],
    structuredOutput: (bruto.structuredOutput as Record<string, unknown>) ?? null,
    artifactIds: artefatosPersistidos.map((a) => a.id),
    artifacts: artefatosPersistidos,
    needsApproval: !!bruto.needsApproval,
    nextAction: bruto.nextAction,
    ...(midiaGerada?.sourceAssetIds ? { sourceAssetIds: midiaGerada.sourceAssetIds } : {}),
    ...(midiaGerada?.logoAssetId ? { logoAssetId: midiaGerada.logoAssetId } : {}),
    ...(midiaGerada?.brandValidation ? { brandValidation: midiaGerada.brandValidation } : {}),
    ...(midiaGerada?.designCritic ? { designCritic: midiaGerada.designCritic } : {}),
    ...(referenciasAprovadas.length ? { approvedReferenceIds: referenciasAprovadas.map((r) => r.id) } : {}),
    ...(designProjectCriado
      ? {
          designProjectId: designProjectCriado.id,
          canvasJson: designProjectCriado.canvasJson,
          version: designProjectCriado.version,
          ...(designProjectCriado.designBrief ? { designBrief: designProjectCriado.designBrief } : {}),
        }
      : {}),
    ...(midiaGerada?.videoProjectCriado
      ? {
          videoProjectId: midiaGerada.videoProjectCriado.id,
          videoTimelineJson: midiaGerada.videoProjectCriado.timelineJson,
          videoTimelineVersion: midiaGerada.videoProjectCriado.timelineVersion,
          videoDurationMs: midiaGerada.videoProjectCriado.durationMs,
        }
      : {}),
    ...(midiaGerada?.referenceVideoProfileCriado
      ? {
          referenceVideoProfileId: midiaGerada.referenceVideoProfileCriado.id,
          referenceVideoProfile: midiaGerada.referenceVideoProfileCriado.perfil,
        }
      : {}),
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
