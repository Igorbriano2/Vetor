import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt, type AgenteId } from "./prompts/index.js";
import { buscarFerramenta } from "../tools/registry.js";
import { gerarVideoAPartirDeImagem, VideoIndisponivelError } from "../integrations/higgsfield.js";
import { gerarProxyDeVideo, renderizarVideoFinal } from "../integrations/renderService.js";
import { transcreverComTimestamps, isSandbox as transcricaoEmSandbox, TranscricaoIndisponivelError } from "../integrations/transcricao.js";
import { gerarPerfilDeVideoDeReferencia } from "../negocio/referenceVideoAnalysis.js";
import { gerarImagem, gerarImagemComReferencia, ImagemIndisponivelError, tamanhoOpenAI, type ReferenciaImagem } from "../integrations/imageProvider.js";
import {
  dimensaoDoTamanhoOpenAI,
  lerDimensaoDeImagem,
  montarCanvasJsonInicial,
  montarCanvasJsonEmCamadas,
  criarDesignProject,
  buscarReferenciasAprovadas,
} from "../negocio/designProjects.js";
import {
  avaliarPecaDeDesign,
  avaliarRiscoDeTextoNoFundo,
  calcularCriteriosEstruturais,
  combinarComCriteriosEstruturais,
  type DesignCriticResultado,
} from "../negocio/designCritic.js";
import {
  mapearFormatoParaAspectRatio,
  montarPromptDeFundo,
  detectarPlaceholder,
  validarAreaSegura,
  luminanciaRelativaHex,
  calcularContraste,
  corDeTextoPadrao,
  estimarAlturaDeTexto,
  CONTRASTE_MINIMO_LEGIVEL,
  type EspecificacaoDeCamada,
  type FormatoPeca,
} from "../negocio/designLayout.js";
import { renderizarPecaComposta, amostrarLuminanciaMedia } from "../negocio/designComposer.js";
import { montarLayoutPorDirecao, ESTILOS_ARTE_DIRECAO, type EstiloArteDirecao } from "../negocio/artDirection.js";
import { ROTA_ESTRATEGICA_SCHEMA, montarPerformanceLinhas, rotaEstrategicaValida, type RotaEstrategica } from "../negocio/rotaEstrategica.js";
import {
  buscarOuCriarVideoProjectRascunho,
  montarTimelineInicial,
  atualizarTimelineDoVideoProject,
  montarCaptionTrackDeSegmentos,
  atualizarCaptionsDoVideoProject,
  atualizarPreviewDoVideoProject,
  atualizarRenderFinalDoVideoProject,
} from "../negocio/videoProjects.js";
import { executarEstagioIdempotente, pularEstagio } from "../negocio/videoPipeline.js";
import { persistirArtefato, type ArtefatoPersistido, type ArtifactType } from "../artifacts/artifactsService.js";
import { calcularCustoEstimadoCentavos } from "../billing/agentRunCost.js";
import { selecionarSkills, carregarSkillsSelecionadas, listarTodosOsManifestos } from "../skills/registry.js";
import { pesquisarMercado, PesquisaWebIndisponivelError } from "../integrations/webSearch.js";
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
            rota: ROTA_ESTRATEGICA_SCHEMA,
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

// Achado real (Fase 3, Planejamento): oferecer `artifacts` como campo
// OPCIONAL dentro de entregar_resultado nunca foi suficiente — em 4
// execuções reais em produção o modelo preferiu escrever um `summary`
// convincente em prosa e pular o array aninhado, mesmo com instrução
// explícita no prompt e um turno de rascunho antes. Esta ferramenta
// separada existe só pra isso: quando oferecida, o ÚNICO jeito de
// respondê-la é preencher o documento de verdade — não tem campo
// "resumo" pra fugir. Usada num turno à parte (ver rodarComFerramentaDeExecucao-
// like flow em executarEspecialista), nunca a única ferramenta disponível
// (o modelo escolhe entre isso e entregar_resultado conforme a etapa
// realmente promete um documento ou não).
export const ENTREGAR_DOCUMENTO_TOOL: Anthropic.Tool = {
  name: "entregar_documento",
  description:
    "Entrega um documento/plano/copy/relatório REAL como artefato salvo — use quando a etapa pede pra criar, consolidar ou " +
    "gerar um documento/calendário/planejamento. O conteúdo aqui É o entregável, não um resumo dele. Depois de chamar isso, " +
    "você ainda vai fechar a etapa com entregar_resultado normalmente.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: [...TIPOS_ARTEFATO_TEXTO] },
      title: { type: "string" },
      content: { type: "string", description: "O conteúdo de verdade — o texto do briefing/copy/plano/relatório, não um resumo dele." },
      periodo: { type: "string", description: "Só pra type=plan — período do planejamento, formato AAAA-MM (ex: '2026-08')." },
      calendario: {
        type: "array",
        description: "Só pra type=plan — calendário editorial real, um item por peça/ação planejada, copiado do conteúdo real já elaborado.",
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
        description: "Só pra type=plan — indicadores reais sugeridos pra acompanhar o período.",
        items: { type: "string" },
      },
      rota: ROTA_ESTRATEGICA_SCHEMA,
    },
    required: ["type", "title", "content"],
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

const FINALIZAR_VIDEO_TOOL: Anthropic.Tool = {
  name: "finalizar_video_com_legendas",
  description:
    "Transcreve o áudio real do vídeo (com timestamps), gera a track de legendas editável, renderiza um preview e o " +
    "MP4 FINAL de verdade — usando a timeline ATUAL do projeto (inclusive qualquer corte que o cliente já tenha " +
    "feito no editor). Use só depois que editar_video_timeline já criou o projeto pra esse vídeo E o cliente já " +
    "confirmou que a edição (corte, etc.) está pronta pra finalizar. Nunca use antes de editar_video_timeline. " +
    "IMPORTANTE: se a etapa pede renderização/finalização e uma etapa anterior desta mesma missão já rodou isso " +
    "(ver RESULTADO DAS ETAPAS ANTERIORES no contexto), CHAME ESTA FERRAMENTA MESMO ASSIM com o mesmo " +
    "video_project_id — cada estágio (captions/preview/final_render) é idempotente e nunca reprocessa o que já " +
    "está pronto, mas é a ÚNICA forma de esta etapa devolver um resultado verificável (video_project_id real). " +
    "Nunca responda 'já está pronto' sem chamar a ferramenta de novo.",
  input_schema: {
    type: "object",
    properties: {
      video_project_id: {
        type: "string",
        description: "Id do video_project já criado (devolvido por editar_video_timeline em videoProjectCriado.id).",
      },
    },
    required: ["video_project_id"],
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
      provider: {
        type: "string",
        enum: ["openai", "gemini"],
        description: "Provider de imagem preferido, só quando a tarefa mencionar explicitamente um. Omita se não mencionar.",
      },
    },
    required: ["prompt"],
  },
};

// Design profissional V1 (camadas reais) — SUBSTITUI gerar_imagem como
// caminho padrão pra peça nova (gerar_imagem fica só pra compatibilidade
// com missões/skills antigas, nunca mais usada por escolha do agente, ver
// prompts/design.md). Diferença central: aqui a IA de imagem NUNCA recebe
// a responsabilidade de desenhar texto/logo — só o cenário/fundo. Texto e
// logo sempre viram camada Fabric real, composta server-side.
const CRIAR_PECA_DESIGN_TOOL: Anthropic.Tool = {
  name: "criar_peca_de_design",
  description:
    "Cria a peça de design como um PROJETO EDITÁVEL DE VERDADE: fundo visual gerado sem nenhum texto, " +
    "headline/subheadline/CTA/legenda como camadas de texto reais e independentes (nunca pixel), ativos reais " +
    "do Drive (produto/pessoa/ambiente) como camadas de imagem próprias, e a logo oficial como camada travada. " +
    "Use SEMPRE esta ferramenta pra peça nova — nunca gerar_imagem (caminho legado, mantido só por " +
    "compatibilidade com missões antigas).",
  input_schema: {
    type: "object",
    properties: {
      visual_prompt: {
        type: "string",
        description:
          "Descrição SÓ do tratamento visual de fundo/cena: composição, cores, iluminação, estilo, recorte, " +
          "ambiente, espaço reservado pra tipografia. NUNCA mencione texto, número, preço, CTA ou logotipo aqui " +
          "— isso vai nos campos separados abaixo e nunca é desenhado pela IA de imagem.",
      },
      headline: { type: "string", description: "Mensagem principal da peça, se o pedido tiver uma — vira camada de texto real." },
      subheadline: { type: "string", description: "Informação de apoio, se houver." },
      cta: { type: "string", description: "Chamada pra ação, se houver (ex: 'Peça já pelo WhatsApp')." },
      caption: { type: "string", description: "Selo/legenda curta adicional, se houver (ex: 'Só hoje')." },
      formato: {
        type: "string",
        enum: ["feed", "story", "reels_cover", "ad", "custom"],
        description: "Formato de destino — decide proporção e a variante certa da logo.",
      },
      aspect_ratio: {
        type: "string",
        description: "Obrigatório quando formato='custom'. Opcional pra 'ad' (default 4:5 se omitido).",
      },
      asset_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "IDs (da lista 'Banco de ativos disponível') de produto/pessoa/ambiente reais a incluir como camada de " +
          "imagem própria — nunca cozidos no fundo gerado. Nunca invente um id.",
      },
      provider: {
        type: "string",
        enum: ["openai", "gemini"],
        description:
          "Provider de geração de imagem preferido, SÓ quando a tarefa mencionar explicitamente um (ex: 'Provider de " +
          "imagem preferido: Gemini'). Omita este campo se a tarefa não mencionar — o sistema usa o padrão e cai pro " +
          "outro provider automaticamente se o preferido falhar.",
      },
      estilo_visual: {
        type: "string",
        enum: ["editorial", "product_hero", "split_screen", "collage", "testimonial", "minimal_authority"],
        description:
          "Direção de arte preferida, SÓ quando a tarefa mencionar explicitamente uma (ex: 'Direção de arte " +
          "preferida: product_hero'). Omita se a tarefa não mencionar — o sistema usa 'editorial' por padrão. Guia: " +
          "product_hero pra produto em destaque absoluto; split_screen pra comparação ou duas mensagens lado a lado; " +
          "collage quando há 2+ ativos reais do Drive pra combinar (cai pro editorial com menos de 2); testimonial " +
          "pra depoimento/prova social com citação; minimal_authority pra marca premium/institucional com pouco " +
          "texto; editorial (padrão) pra oferta/promoção com headline forte no topo.",
      },
    },
    required: ["visual_prompt", "formato"],
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
  // Sinal estruturado e real (nunca inferido de texto): a ferramenta de
  // geração de imagem esgotou todos os provedores do ProviderRouter
  // (ImagemIndisponivelError) nesta execução, mesmo que o especialista
  // ainda assim tenha entregue um briefing como fallback. Consumido pelo
  // painel (pecaStatus.ts) pra mostrar uma explicação honesta em vez de um
  // erro técnico cru ou silêncio (Vetor Manager Fase 2).
  imagemIndisponivel?: boolean;
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
  // Resultado real das etapas das quais esta depende (mission_steps.depende_de)
  // — achado real na prova do Videomaker: uma etapa que precisa do
  // video_project_id criado pela etapa anterior (ex: finalizar_video_com_legendas
  // depois de editar_video_timeline) não tinha como saber esse id, porque cada
  // etapa só recebia a própria tarefa, nunca o resultado de quem veio antes.
  etapasAnteriores?: Array<{ tarefa: string; resultado: unknown }>;
  // Calculado pelo orchestrator ANTES de chamar o especialista (sabe se
  // esta é a etapa terminal de "estrategia", ver DEPARTAMENTOS_EXIGEM_ARTEFATO
  // em orchestrator.ts) — quando true, o especialista nem oferece a escolha
  // entre entregar_resultado/entregar_documento, força entregar_documento
  // direto. Achado real: oferecer como escolha não bastou (o modelo
  // repetidamente escolhia só entregar_resultado mesmo sabendo que a
  // tarefa pedia um documento).
  exigeDocumento?: boolean;
  // Fase 4 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — achado real
  // da auditoria: especialistas de execução nunca liam memoria_operacional de
  // volta, só o agente de chat (vetorPlataforma.ts) lia. Mesmo formato/limite
  // (10 mais recentes do cliente) — nunca inventado, lista vazia quando não
  // há memória registrada ainda.
  memoriasRecentes?: Array<{ tipo: string; conteudo: string; confianca: string; origem: string }>;
  // Nomes de ferramenta que a etapa declarou no plano (mission_steps.ferramentas)
  // — já passaram pelo Policy Engine (avaliarRisco/aprovação) no orchestrator.
  // Achado real: ferramentasGeracao (abaixo) é indexado só por agenteId, sem
  // nenhuma checagem contra o que a etapa de fato declarou — uma etapa de
  // Design declarada só com ferramentas de baixo risco (criar_briefing,
  // gerar_design) ainda assim tinha acesso irrestrito a criar_peca_de_design/
  // gerar_imagem (custo real, nunca aprovado por ninguém). Usado abaixo pra
  // nunca oferecer uma ferramenta de geração real (custo/efeito externo) que
  // não foi declarada nesta etapa especificamente.
  ferramentasDeclaradas?: string[];
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
    // Design profissional V1 (camadas reais) — quando presente, o bloco de
    // criação do design_project usa ESTE canvasJson pronto (montado por
    // montarCanvasJsonEmCamadas, ver criar_peca_de_design) em vez de chamar
    // montarCanvasJsonInicial(fundo+logo) — a ferramenta nova já resolveu
    // texto/imagens reais/logo como camadas independentes, o bloco
    // compartilhado só precisa persistir.
    canvasJsonPronto?: unknown;
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
  videoProjectCriado?: {
    id: string;
    timelineVersion: number;
    timelineJson: unknown;
    durationMs: number;
    // Preenchidos só quando os estágios de captions/preview/final_render
    // realmente rodaram nesta chamada (podem faltar se essa etapa só
    // fez o proxy/timeline_draft — ver comentário na prova real do
    // Videomaker: captions/preview/final_render são estágios adicionais
    // opcionais, não sempre disparados por editar_video_timeline).
    captionsGeradas?: { cues: Array<{ id: string; startMs: number; endMs: number; text: string }>; language: "pt-BR" };
    previewStoragePath?: string;
    outputStoragePath?: string;
  };
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

// gerar_imagem é o nome que o catálogo do Vetor (prompts/vetor.md) e o Policy
// Engine conhecem pra "gerar a peça visual final" — mas o próprio prompt do
// especialista de Design instrui "nunca gerar_imagem, sempre
// criar_peca_de_design" (ver CRIAR_PECA_DESIGN_TOOL). Sem este alias, uma
// etapa declarada/aprovada com gerar_imagem nunca liberava de fato a
// ferramenta que o especialista realmente chama, quebrando toda geração de
// imagem real de Design depois do filtro por ferramentasDeclaradas abaixo.
const ALIAS_FERRAMENTA_GERACAO: Record<string, string[]> = {
  gerar_imagem: ["criar_peca_de_design"],
};

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
      tool: FINALIZAR_VIDEO_TOOL,
      tipo: "video",
      titulo: "Vídeo finalizado (legendas + render final)",
      mimeType: "video/mp4",
      criaArtefatoGenerico: false,
      executar: async (input, ctx) => {
        const videoProjectId = input.video_project_id as string;

        const { data: projeto, error: erroProjeto } = await supabase
          .from("video_projects")
          .select("timeline_json, proxy_storage_path, timeline_version")
          .eq("id", videoProjectId)
          .eq("cliente_id", ctx.clienteId)
          .single();
        if (erroProjeto || !projeto) throw new Error(`video_project não encontrado pra esse cliente: ${erroProjeto?.message ?? videoProjectId}`);
        if (!projeto.proxy_storage_path) throw new Error("video_project ainda não tem proxy — rode editar_video_timeline primeiro.");

        // Lê o clip real da timeline ATUAL (inclusive qualquer corte já
        // feito pelo cliente no editor via autosave) — preview e final
        // render precisam usar exatamente o mesmo trim, nunca dois valores
        // diferentes (checkpoint da prova real do Videomaker).
        const timelineAtual = projeto.timeline_json as {
          tracks?: Array<{ kind?: string; clips?: Array<{ sourceAssetId?: string; trimInMs?: number; trimOutMs?: number }> }>;
        };
        const trackVideo = timelineAtual.tracks?.find((t) => t.kind === "video");
        const clip = trackVideo?.clips?.[0];
        if (!clip?.sourceAssetId) throw new Error("Timeline sem clip de vídeo — nada pra finalizar.");
        const assetId = clip.sourceAssetId;
        const trimInMs = clip.trimInMs ?? 0;
        const trimOutMs = clip.trimOutMs;
        if (typeof trimOutMs !== "number") throw new Error("Clip sem trimOutMs definido — timeline inválida pra finalizar.");

        const asset = await buscarAtivoPorId(assetId);
        if (!asset) throw new Error("Ativo de vídeo de origem não encontrado.");

        const captionTrackVazia = { cues: [] as Array<{ id: string; startMs: number; endMs: number; text: string }>, language: "pt-BR" as const };

        // Estágio "captions" — em ambiente sandbox (sem STT_PROVIDER real),
        // marca como pulado com o motivo real em vez de fingir uma
        // transcrição. Fora do sandbox, uma falha real do provider fica
        // PERSISTIDA como "failed" no estágio (nunca escondida) — mas não
        // trava corte/preview/final_render, que não dependem de legenda
        // (achado real: vídeo de teste sem faixa de áudio decodificável
        // fazia a missão inteira travar antes desta mudança, mesmo o corte
        // e o render não tendo nada a ver com áudio).
        const captionsResultado = transcricaoEmSandbox()
          ? await (async () => {
              await pularEstagio(videoProjectId, ctx.clienteId, "captions", "STT_PROVIDER não configurado neste ambiente.");
              return { captionTrack: captionTrackVazia };
            })()
          : await executarEstagioIdempotente(videoProjectId, ctx.clienteId, "captions", async () => {
              // Transcreve só o trecho CORTADO (renderiza um recorte leve a
              // partir do PROXY, sem legendas ainda) — nunca o arquivo
              // original inteiro: além de mais rápido, evita estourar o
              // limite de 25MB da OpenAI em originais grandes (achado real
              // da prova do Videomaker: um original de ~95MB falhava direto
              // na transcrição antes desta mudança).
              const trecho = await renderizarVideoFinal({
                bucket: "artifacts",
                storagePath: projeto.proxy_storage_path as string,
                clienteId: ctx.clienteId,
                trimInMs,
                trimOutMs,
              });
              const { data: baixado, error: erroDownload } = await supabase.storage.from("artifacts").download(trecho.storagePath);
              if (erroDownload || !baixado) throw new Error(`Falha ao baixar o trecho cortado pra transcrição: ${erroDownload?.message ?? "não encontrado"}`);
              const bytesTrecho = await baixado.arrayBuffer();
              const segmentos = await transcreverComTimestamps(bytesTrecho, asset.mimeType ?? "video/mp4");
              const captionTrack = montarCaptionTrackDeSegmentos(segmentos);
              await atualizarCaptionsDoVideoProject(videoProjectId, captionTrack);
              return { captionTrack };
            }).catch(() => {
              // executarEstagioIdempotente já persistiu status "failed" +
              // o erro real no estágio "captions" (visível no painel e em
              // video_pipeline_stages) — aqui só evita que essa falha
              // aborte preview/final_render, que seguem sem legenda.
              return { captionTrack: captionTrackVazia };
            });

        const cuesParaRender = captionsResultado.captionTrack.cues.map((c) => ({ startMs: c.startMs, endMs: c.endMs, text: c.text }));

        // Estágio "preview" — mesma timeline (trim + legendas) do final,
        // mas a partir do PROXY (leve, rápido) — nunca do original.
        const preview = await executarEstagioIdempotente(videoProjectId, ctx.clienteId, "preview", () =>
          renderizarVideoFinal({
            bucket: "artifacts",
            storagePath: projeto.proxy_storage_path as string,
            clienteId: ctx.clienteId,
            trimInMs,
            trimOutMs,
            captions: cuesParaRender,
          }),
        );
        await atualizarPreviewDoVideoProject(videoProjectId, preview.storagePath);

        // Estágio "final_render" — mesma timeline, mas a partir do
        // ORIGINAL enviado pelo cliente (qualidade real de entrega, ver
        // regra em apps/render/src/ffmpeg/finalRender.ts).
        const renderFinal = await executarEstagioIdempotente(videoProjectId, ctx.clienteId, "final_render", () =>
          renderizarVideoFinal({
            bucket: "brand-assets",
            storagePath: asset.storagePath,
            clienteId: ctx.clienteId,
            trimInMs,
            trimOutMs,
            captions: cuesParaRender,
          }),
        );
        await atualizarRenderFinalDoVideoProject(videoProjectId, renderFinal.storagePath);

        await registrarUsoDeAtivo({
          clienteId: ctx.clienteId,
          assetId,
          missionId: ctx.missionId,
          missionStepId: ctx.missionStepId,
          agente: "video",
          papel: "fonte",
          motivo: "Arquivo de origem enviado pelo cliente pra transcrição e render final.",
        });

        return {
          requestId: videoProjectId,
          sourceAssetIds: [assetId],
          videoProjectCriado: {
            id: videoProjectId,
            timelineVersion: projeto.timeline_version as number,
            timelineJson: { ...timelineAtual, captions: captionsResultado.captionTrack },
            durationMs: trimOutMs - trimInMs,
            captionsGeradas: captionsResultado.captionTrack,
            previewStoragePath: preview.storagePath,
            outputStoragePath: renderFinal.storagePath,
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
        const providerPreferido = typeof input.provider === "string" ? input.provider : undefined;

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
            ? await gerarImagemComReferencia(prompt, referencias, { aspectRatio, provider: providerPreferido })
            : await gerarImagem(prompt, { aspectRatio, provider: providerPreferido });

        const requestId = randomUUID();
        const path = `${ctx.clienteId}/design/${ctx.missionStepId}/${requestId}.png`;
        const { error } = await supabase.storage
          .from("artifacts")
          .upload(path, imagem.bytes, { contentType: imagem.mimeType, upsert: false });
        if (error) throw new Error(`Falha ao salvar imagem gerada no storage: ${error.message}`);

        // Decodifica a dimensão real dos bytes — nunca confia na tabela de
        // tamanhos fixos da OpenAI, que não se aplica quando o Gemini (Nano
        // Banana) respondeu via fallback do ProviderRouter (ver
        // imageProvider.ts). Só cai pra tabela se a decodificação falhar.
        const { width, height } = lerDimensaoDeImagem(imagem.bytes) ?? dimensaoDoTamanhoOpenAI(tamanhoOpenAI(aspectRatio));

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
    {
      tool: CRIAR_PECA_DESIGN_TOOL,
      tipo: "image",
      titulo: "Peça de design (camadas editáveis)",
      mimeType: "image/png",
      criaArtefatoGenerico: true,
      executar: async (input, ctx) => {
        try {
          return await executarCriarPecaDeDesign(input, ctx);
        } catch (err) {
          throw err instanceof ImagemIndisponivelError ? err : new ImagemIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
        }
      },
    },
  ],
};

// Mapeia o formato novo (feed/story/reels_cover/ad/custom) pro vocabulário
// que buscarLogoParaFormato já entende — reels_cover usa a mesma variante
// de story (retrato), ad/custom caem no fallback "principal" da logo
// (nunca ficam sem logo só por não ter uma variante específica cadastrada
// pro formato novo).
function mapearFormatoParaLogo(formato: FormatoPeca): string {
  if (formato === "reels_cover") return "story";
  if (formato === "ad") return "feed";
  if (formato === "custom") return "generico";
  return formato;
}

// Lê fonte/cor do BrandKit de forma defensiva — o schema de `fontes`/`cores`
// é jsonb livre, sem shape fixo — nunca assume uma chave que pode não
// existir, sempre cai num fallback seguro e nunca lança erro por causa
// disso. Duas famílias, não uma: brandbooks reais (ex: Dog King) separam
// fonte de título/destaque (headline, CTA — o que precisa "gritar") de
// fonte de apoio (subheadline, caption — texto corrido, mais legível em
// tamanho menor). Sem "apoio" cadastrado, cai pra mesma fonte do título
// (nunca duas fontes por acidente quando só uma foi informada).
function resolverFonteDoBrandKit(
  brandKit: ContextoExecucaoFerramenta["brandKit"],
): { fontFamilyTitulo: string; fontFamilyApoio: string; fallbackUsado: boolean } {
  const fontes = brandKit?.fontes as { principal?: unknown; titulo?: unknown; apoio?: unknown } | null | undefined;
  const candidataTitulo = fontes?.principal ?? fontes?.titulo;
  if (typeof candidataTitulo === "string" && candidataTitulo.trim()) {
    const titulo = candidataTitulo.trim();
    const candidataApoio = fontes?.apoio;
    const apoio = typeof candidataApoio === "string" && candidataApoio.trim() ? candidataApoio.trim() : titulo;
    return { fontFamilyTitulo: titulo, fontFamilyApoio: apoio, fallbackUsado: false };
  }
  return { fontFamilyTitulo: "sans", fontFamilyApoio: "sans", fallbackUsado: true };
}

function resolverCorPrimariaDoBrandKit(brandKit: ContextoExecucaoFerramenta["brandKit"]): string | null {
  const cores = brandKit?.cores as { primaria?: unknown; texto?: unknown } | null | undefined;
  const candidata = cores?.primaria;
  return typeof candidata === "string" && /^#[0-9a-fA-F]{3,6}$/.test(candidata.trim()) ? candidata.trim() : null;
}

// Design profissional V1 (camadas reais) — orquestra o fluxo completo de
// criar_peca_de_design: fundo gerado sem texto -> camadas reais de
// texto/imagem/logo montadas em cima -> render server-side do preview a
// partir das MESMAS camadas -> DesignCritic (visual + estrutural) sobre o
// resultado real. Cada passo é real (nenhuma etapa "finge" — ver princípio
// geral do produto), mesmo custando mais tempo/chamadas que o fluxo antigo.
async function executarCriarPecaDeDesign(input: Record<string, unknown>, ctx: ContextoExecucaoFerramenta): Promise<MidiaExecutada> {
  const visualPromptBruto = input.visual_prompt as string;
  const formato = input.formato as FormatoPeca;
  const aspectRatioInput = input.aspect_ratio as string | undefined;
  const aspectRatio = mapearFormatoParaAspectRatio(formato, aspectRatioInput);
  const assetIdsPedidos = Array.isArray(input.asset_ids) ? (input.asset_ids as string[]).filter((id) => typeof id === "string") : [];
  const providerPreferido = typeof input.provider === "string" ? input.provider : undefined;

  const issuesBrand: string[] = [];

  // Campos de texto pedidos pelo agente — "obrigatório" aqui significa
  // "o briefing pediu isso", não um valor fixo de schema. Placeholder
  // detectado NUNCA vira camada (nunca persiste "[CTA]" como se fosse
  // copy real) — conta como obrigatório-mas-ausente, derruba
  // hasEditableTextLayers no Critic.
  const CAMPOS_TEXTO = ["headline", "subheadline", "cta", "caption"] as const;
  type CampoTexto = (typeof CAMPOS_TEXTO)[number];
  const valoresBrutos: Record<CampoTexto, string | undefined> = {
    headline: typeof input.headline === "string" ? input.headline : undefined,
    subheadline: typeof input.subheadline === "string" ? input.subheadline : undefined,
    cta: typeof input.cta === "string" ? input.cta : undefined,
    caption: typeof input.caption === "string" ? input.caption : undefined,
  };
  const camposObrigatorios = CAMPOS_TEXTO.filter((campo) => !!valoresBrutos[campo]?.trim());
  const camposValidos = camposObrigatorios.filter((campo) => {
    const valor = valoresBrutos[campo]!.trim();
    const ehPlaceholder = detectarPlaceholder(valor);
    if (ehPlaceholder) issuesBrand.push(`Campo "${campo}" continha um placeholder ("${valor}") e foi descartado — nunca persistido como copy real.`);
    return !ehPlaceholder;
  });

  // 1) Fundo — SÓ texto-pra-imagem, nunca image-to-image com ativos reais
  // (produto/pessoa/logo entram como camada própria depois, nunca cozidos
  // no fundo) e nunca recebe instrução de desenhar texto (montarPromptDeFundo
  // garante isso em código, não só no prompt do agente).
  const promptDeFundo = montarPromptDeFundo(visualPromptBruto);
  const imagemFundo = await gerarImagem(promptDeFundo, { aspectRatio, provider: providerPreferido });
  // Decodifica a dimensão real dos bytes — nunca confia na tabela de
  // tamanhos fixos da OpenAI, que não se aplica quando o Gemini (Nano
  // Banana) respondeu via fallback do ProviderRouter (ver imageProvider.ts).
  const { width, height } = lerDimensaoDeImagem(imagemFundo.bytes) ?? dimensaoDoTamanhoOpenAI(tamanhoOpenAI(aspectRatio));

  const requestId = randomUUID();
  const pathFundo = `${ctx.clienteId}/design/${ctx.missionStepId}/${requestId}-fundo.png`;
  const { error: erroUploadFundo } = await supabase.storage.from("artifacts").upload(pathFundo, imagemFundo.bytes, { contentType: imagemFundo.mimeType, upsert: false });
  if (erroUploadFundo) throw new Error(`Falha ao salvar o fundo gerado no storage: ${erroUploadFundo.message}`);

  const luminanciaGeralDoFundo = await amostrarLuminanciaMedia(imagemFundo.bytes, { x: 0, y: 0, width, height });

  // 2) Logo oficial — nunca desenhada pela IA, nunca enviada como
  // referência de image-to-image; só entra como camada travada separada
  // (mesma regra inegociável do fluxo antigo).
  const formatoLogo = mapearFormatoParaLogo(formato);
  const logo = await buscarLogoParaFormato(ctx.clienteId, formatoLogo);
  let logoBytes: Buffer | null = null;
  let logoDimensaoReal: { width: number; height: number } | null = null;
  if (logo) {
    logoBytes = await baixarBytesDoAtivo(logo.id);
    if (logoBytes) {
      logoDimensaoReal = lerDimensaoDeImagem(logoBytes);
      await registrarUsoDeAtivo({
        clienteId: ctx.clienteId,
        assetId: logo.id,
        missionId: ctx.missionId,
        missionStepId: ctx.missionStepId,
        agente: "design",
        papel: "logo",
        motivo: `Logo oficial aplicada como camada independente (formato: ${formato}).`,
      });
    } else {
      issuesBrand.push("Logo oficial está cadastrada, mas o arquivo não pôde ser baixado do storage — peça bloqueada até corrigir o ativo.");
    }
  }

  // 3) Ativos reais do Drive (produto/pessoa/ambiente) — SEMPRE camada de
  // imagem própria, nunca image-to-image (fica genuinamente editável:
  // mover/redimensionar sem regenerar nada). Limitado a 2 pra manter um
  // layout determinístico simples nesta V1 — mais que isso exigiria um
  // algoritmo de composição mais sofisticado, fora de escopo aqui.
  interface AtivoDriveResolvido {
    assetId: string;
    storagePath: string;
    bytes: Buffer;
    naturalWidth: number;
    naturalHeight: number;
    role: "produto" | "pessoa" | "elemento";
  }
  const ativosDrive: AtivoDriveResolvido[] = [];
  let algumAtivoPedidoInvalido = false;
  for (const assetId of assetIdsPedidos.slice(0, 2)) {
    // Achado em teste real de produção: a busca de assets do Drive pode
    // devolver o MESMO arquivo que já foi resolvido como logo oficial
    // acima (ex: a logo também está catalogada em "identidade visual" no
    // banco de ativos) — sem esse filtro, a logo aparece duas vezes na
    // peça: uma vez certa (camada "logo", travada, vinculada ao BrandKit)
    // e outra errada (camada "produto" solta, gigante, editável).
    if (logo && assetId === logo.id) {
      issuesBrand.push(`Ativo "${assetId}" pedido como referência de produto/campanha é o mesmo arquivo da logo oficial — ignorado aqui pra não duplicar a logo na peça.`);
      continue;
    }
    const validacao = await validarAtivoParaUso(ctx.clienteId, assetId);
    if (!validacao.valido) {
      algumAtivoPedidoInvalido = true;
      issuesBrand.push(`Ativo "${assetId}" pedido pra composição não é válido: ${validacao.motivo}`);
      continue;
    }
    const ativo = await buscarAtivoPorId(assetId);
    const bytes = await baixarBytesDoAtivo(assetId);
    if (!ativo || !bytes) {
      algumAtivoPedidoInvalido = true;
      issuesBrand.push(`Ativo "${assetId}" pedido pra composição não pôde ser baixado do storage.`);
      continue;
    }
    const dimensaoReal = ativo.width && ativo.height ? { width: ativo.width, height: ativo.height } : lerDimensaoDeImagem(bytes);
    if (!dimensaoReal) {
      algumAtivoPedidoInvalido = true;
      issuesBrand.push(`Ativo "${assetId}" não teve dimensão real decodificada — descartado pra nunca distorcer.`);
      continue;
    }
    ativosDrive.push({ assetId, storagePath: ativo.storagePath, bytes, naturalWidth: dimensaoReal.width, naturalHeight: dimensaoReal.height, role: "produto" });
    await registrarUsoDeAtivo({
      clienteId: ctx.clienteId,
      assetId,
      missionId: ctx.missionId,
      missionStepId: ctx.missionStepId,
      agente: "design",
      papel: "produto",
      motivo: "Selecionado pelo agente como camada de imagem própria (composição em camadas).",
    });
  }

  // 4) Direção de arte (ArtDirectionSpec, Fase 9) — o estilo escolhido
  // decide o arranjo geométrico inteiro via montarLayoutPorDirecao()
  // (apps/agentes/src/negocio/artDirection.ts). Estilo ausente ou inválido
  // cai pro "editorial" — o layout já provado em produção, comportamento
  // idêntico ao fluxo antigo de layout único.
  const { fontFamilyTitulo, fontFamilyApoio, fallbackUsado: fonteFallbackUsada } = resolverFonteDoBrandKit(ctx.brandKit);
  const corPrimaria = resolverCorPrimariaDoBrandKit(ctx.brandKit);
  const margem = Math.round(Math.min(width, height) * 0.07);
  const estiloPedido = typeof input.estilo_visual === "string" ? input.estilo_visual : undefined;
  const estiloEscolhido: EstiloArteDirecao = (ESTILOS_ARTE_DIRECAO as readonly string[]).includes(estiloPedido ?? "")
    ? (estiloPedido as EstiloArteDirecao)
    : "editorial";

  const camadas: EspecificacaoDeCamada[] = [
    { tipo: "imagem", role: "fundo", source: "generated", storagePath: pathFundo, bucket: "artifacts", bytes: imagemFundo.bytes, naturalWidth: width, naturalHeight: height, x: 0, y: 0, width, height },
  ];

  const camadasDeConteudo = await montarLayoutPorDirecao(estiloEscolhido, {
    width,
    height,
    margem,
    pathFundo,
    fundoBytes: imagemFundo.bytes,
    luminanciaGeralDoFundo,
    textos: {
      headline: camposValidos.includes("headline") ? valoresBrutos.headline!.trim() : undefined,
      subheadline: camposValidos.includes("subheadline") ? valoresBrutos.subheadline!.trim() : undefined,
      cta: camposValidos.includes("cta") ? valoresBrutos.cta!.trim() : undefined,
      caption: camposValidos.includes("caption") ? valoresBrutos.caption!.trim() : undefined,
    },
    fontFamilyTitulo,
    fontFamilyApoio,
    corPrimaria,
    ativosDrive,
    logo:
      logo && logoBytes && logoDimensaoReal
        ? { id: logo.id, storagePath: logo.storagePath, bytes: logoBytes, naturalWidth: logoDimensaoReal.width, naturalHeight: logoDimensaoReal.height }
        : null,
  });
  camadas.push(...camadasDeConteudo);

  // 5) Validações reais (Fase 3) — área segura e contraste medido de
  // verdade contra os pixels do FUNDO (o texto ainda não existe nos
  // pixels do fundo, então a amostra é honesta) em cada camada de texto;
  // nunca aprovado só porque "parece que dá pra ler".
  let areaSeguraOk = true;
  for (const camada of camadas) {
    if (camada.tipo === "texto") {
      const altura = estimarAlturaDeTexto(camada.texto, camada.width, camada.fontSize);
      const dentroDaArea = validarAreaSegura({ x: camada.x, y: camada.y, width: camada.width, height: altura }, width, height, 0.03);
      if (!dentroDaArea) {
        areaSeguraOk = false;
        issuesBrand.push(`Camada de texto "${camada.field}" ficou fora da área segura do formato.`);
        continue;
      }
      const luminanciaLocal = await amostrarLuminanciaMedia(imagemFundo.bytes, { x: camada.x, y: camada.y, width: camada.width, height: altura });
      const contraste = calcularContraste(luminanciaLocal, luminanciaRelativaHex(camada.fill));
      if (contraste < CONTRASTE_MINIMO_LEGIVEL) {
        issuesBrand.push(`Contraste insuficiente (${contraste.toFixed(1)}:1, mínimo ${CONTRASTE_MINIMO_LEGIVEL}:1) na camada "${camada.field}" contra o fundo real.`);
      }
    } else if (camada.tipo === "logo") {
      if (!validarAreaSegura({ x: camada.x, y: camada.y, width: camada.width, height: camada.height }, width, height, 0.02)) {
        areaSeguraOk = false;
        issuesBrand.push("A logo ficou fora da área segura do formato.");
      }
    }
  }

  if (fonteFallbackUsada && (camposValidos.length > 0)) {
    issuesBrand.push("BrandKit não tem fonte cadastrada — usada uma fonte segura padrão (sans) como fallback.");
  }

  // 6) Preview real renderizado a partir das MESMAS camadas que viram o
  // canvasJson — nunca duas lógicas de layout divergentes (ver
  // designComposer.ts).
  const corDeFundoDoCanvas = "#ffffff";
  const previewBytes = await renderizarPecaComposta({ width, height, corDeFundo: corDeFundoDoCanvas, camadas });
  const pathPreview = `${ctx.clienteId}/design/${ctx.missionStepId}/${requestId}.png`;
  const { error: erroUploadPreview } = await supabase.storage.from("artifacts").upload(pathPreview, previewBytes, { contentType: "image/png", upsert: false });
  if (erroUploadPreview) throw new Error(`Falha ao salvar o preview composto no storage: ${erroUploadPreview.message}`);

  // 7) DesignCritic — visual (sobre o preview real composto) + estrutural
  // (5 critérios novos, ver designCritic.ts) + risco de texto no fundo
  // (visão real sobre o fundo isolado, antes de qualquer composição).
  const briefParaCritic = [
    visualPromptBruto,
    camposValidos.includes("headline") ? `Headline: ${valoresBrutos.headline}` : null,
    camposValidos.includes("cta") ? `CTA: ${valoresBrutos.cta}` : null,
    // Contexto de estilo (sem virar critério novo) — o Critic já avalia
    // composicaoHierarquia/proporcao/alinhamento; sabendo qual dos 6
    // arranjos foi usado, esses critérios existentes julgam com o padrão
    // certo (ex: texto centralizado é esperado em "testimonial", não em
    // "editorial").
    `Direção de arte usada: ${estiloEscolhido}`,
  ]
    .filter(Boolean)
    .join("\n");

  const [criticoVisual, riscoDeTextoNoFundo] = await Promise.all([
    avaliarPecaDeDesign({
      imagemBytes: previewBytes,
      mimeType: "image/png",
      briefOriginal: briefParaCritic,
      formato,
      brandKit: ctx.brandKit,
      logoDeveriaEstarAplicada: !!logo,
    }),
    avaliarRiscoDeTextoNoFundo(imagemFundo.bytes, imagemFundo.mimeType),
  ]);

  const criteriosEstruturais = calcularCriteriosEstruturais({
    camposDeTextoObrigatorios: camposObrigatorios,
    camposDeTextoPresentes: camposValidos,
    logoObrigatoria: !!logo,
    logoPresenteComoCamadaIndependente: !!(logo && logoBytes && logoDimensaoReal),
    areaSeguraValidaParaTodasAsCamadas: areaSeguraOk,
    ativosDeMarcaValidos: !algumAtivoPedidoInvalido,
  });

  const designCritic = combinarComCriteriosEstruturais(criticoVisual, { ...criteriosEstruturais, backgroundHasEmbeddedTextRisk: riscoDeTextoNoFundo });

  const sourceAssetIds = [...ativosDrive.map((a) => a.assetId), ...(logo ? [logo.id] : [])];

  const canvasJson = montarCanvasJsonEmCamadas({ canvasWidth: width, canvasHeight: height, corDeFundo: corDeFundoDoCanvas, camadas });

  return {
    requestId,
    storagePath: pathPreview,
    mimeType: "image/png",
    sourceAssetIds,
    logoAssetId: logo?.id,
    brandValidation: { passed: issuesBrand.length === 0, issues: issuesBrand },
    designCritic,
    canvasInfo: {
      width,
      height,
      canvasJsonPronto: canvasJson,
      ...(logo && logoDimensaoReal
        ? { logo: { assetId: logo.id, storagePath: logo.storagePath, naturalWidth: logoDimensaoReal.width, naturalHeight: logoDimensaoReal.height } }
        : {}),
    },
    promptUsado: briefParaCritic,
  };
}

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
    ctx.etapasAnteriores?.length
      ? `RESULTADO DAS ETAPAS ANTERIORES DESTA MISSÃO (use os ids/dados reais aqui — ex: video_project_id — em vez de pedir de novo ou inventar um):\n` +
        ctx.etapasAnteriores.map((e) => `- Etapa "${e.tarefa}": ${JSON.stringify(e.resultado)}`).join("\n")
      : null,
    `NEGÓCIO: ${ctx.negocio.nomeEmpresa} (nicho: ${ctx.negocio.nicho})`,
    ctx.negocio.perfil?.descricao ? `Perfil de negócio: ${ctx.negocio.perfil.descricao}` : null,
    ctx.negocio.perfil?.tom ? `Tom de voz: ${ctx.negocio.perfil.tom}` : null,
    ctx.negocio.brandKit ? `Brand kit atual: ${JSON.stringify(ctx.negocio.brandKit)}` : null,
    // Fase 4 do Vetor Manager UX — mesmo dado que o agente de chat já lia
    // (memoria_operacional), agora também disponível pro especialista que
    // de fato executa a etapa. Confiança baixa/média não vira instrução
    // implícita — só informa, o especialista decide se usa.
    ctx.memoriasRecentes?.length
      ? `MEMÓRIA REGISTRADA SOBRE ESTE CLIENTE (fatos/preferências/decisões de conversas anteriores — considere, mas não trate como regra absoluta quando a confiança for baixa):\n` +
        ctx.memoriasRecentes.map((m) => `- [${m.tipo}, confiança ${m.confianca}, origem ${m.origem}] ${m.conteudo}`).join("\n")
      : null,
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
  // Sinal estruturado (não texto livre) de que a ferramenta de geração
  // real falhou especificamente por ImagemIndisponivelError (todos os
  // provedores do ProviderRouter esgotados) — mesmo que o LLM continue e
  // entregue um briefing como fallback depois. Vetor Manager Fase 2: o
  // painel usa isto pra mostrar "provedor indisponível, aqui está o
  // briefing" em vez de um erro técnico cru ou silêncio sem explicação
  // (nunca inferido por parsing de texto do summary).
  imagemIndisponivel?: boolean;
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
  let imagemIndisponivel = false;
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
    if (!chamada) return { message: response, midiaGerada, ferramentaUsada, imagemIndisponivel };

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
      if (err instanceof ImagemIndisponivelError) imagemIndisponivel = true;
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
  return { message: response, midiaGerada, ferramentaUsada, imagemIndisponivel };
}

const PESQUISAR_MERCADO_TOOL: Anthropic.Tool = {
  name: "pesquisar_mercado",
  description:
    "Pesquisa real na web sobre o mercado local, concorrência ou o negócio do cliente. Use quando a " +
    "etapa pedir um diagnóstico de mercado/concorrência de verdade — nunca invente concorrente ou " +
    "dado de mercado sem essa ferramenta.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Busca real, ex: 'concorrentes hamburgueria Cambé PR'." } },
    required: ["query"],
  },
};

// Turno curto e isolado (no máximo 1 chamada) oferecendo pesquisa web real
// antes do fluxo principal de Estratégia/Growth. tool_choice "auto": o
// modelo só pesquisa se decidir que precisa — se não pesquisar, ou se
// TAVILY_API_KEY não estiver configurada (PesquisaWebIndisponivelError), o
// bloco volta vazio e o resto do fluxo roda exatamente como antes desta
// fase, sem nenhuma mudança de comportamento.
async function obterPesquisaDeMercadoSeUsada(nomeEmpresa: string, nicho: string, etapaTarefa: string): Promise<string> {
  const resposta = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    system:
      `Negócio: ${nomeEmpresa} (${nicho}). Tarefa da etapa: ${etapaTarefa}\n\n` +
      "Se esta tarefa pede diagnóstico de mercado/concorrência real, chame pesquisar_mercado com uma " +
      "query específica agora. Se não precisar de pesquisa de mercado, não chame nenhuma ferramenta.",
    messages: [{ role: "user", content: "Decida." }],
    tools: [PESQUISAR_MERCADO_TOOL],
    tool_choice: { type: "auto" },
  });

  const chamada = resposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "pesquisar_mercado");
  if (!chamada) return "";

  const query = (chamada.input as Record<string, unknown>).query;
  if (typeof query !== "string" || !query.trim()) return "";

  try {
    const resultado = await pesquisarMercado(query);
    const linhas = resultado.resultados.map((r) => `- ${r.titulo} (${r.url}): ${r.resumo}`).join("\n");
    return `\n\nPESQUISA DE MERCADO REAL (query: "${query}"):\n${resultado.respostaDireta ?? ""}\n${linhas}`.trim().length
      ? `\n\nPESQUISA DE MERCADO REAL (query: "${query}"):\n${resultado.respostaDireta ?? ""}\n${linhas}`
      : "";
  } catch (err) {
    if (err instanceof PesquisaWebIndisponivelError) {
      return `\n\nPESQUISA DE MERCADO: tentou pesquisar "${query}" mas não está disponível (${err.message}) — não simule dado de mercado, sinalize isso honestamente no diagnóstico.`;
    }
    throw err;
  }
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

  // Fase A do prompt de reconstrução — pesquisa web real só oferecida a
  // Estratégia/Growth (os únicos agentes que hoje precisam de diagnóstico de
  // mercado/concorrência real). Turno curto e isolado ANTES do resto do
  // fluxo já provado (rascunho/escolha) — nunca altera esse fluxo, só
  // enriquece o systemPrompt se o modelo decidir pesquisar. Sem
  // TAVILY_API_KEY, a ferramenta retorna erro claro e o bloco fica vazio
  // (degrada pro comportamento de hoje, nunca quebra a etapa).
  const blocoPesquisa =
    agenteId === "estrategia" || agenteId === "growth"
      ? await obterPesquisaDeMercadoSeUsada(contexto.negocio.nomeEmpresa, contexto.negocio.nicho, contexto.etapaTarefa)
      : "";

  const systemPrompt = `${getSystemPrompt(agenteId)}\n\n${montarContexto(contexto)}${blocoSkill}${blocoReferencias}${blocoPesquisa}`;
  const departamento = DEPARTAMENTO_POR_AGENTE[agenteId];
  // Fail-closed: uma ferramenta de geração real só é oferecida ao especialista
  // se ela mesma é de baixo risco no Tool Registry OU se o nome dela (ou de um
  // alias dela — ver ALIAS_FERRAMENTA_GERACAO) foi explicitamente declarado em
  // mission_steps.ferramentas (e portanto já passou por avaliarRisco/aprovação
  // no orchestrator) — nunca por já existir no mapa por agente. Ver comentário
  // em ContextoMissaoParaEspecialista.ferramentasDeclaradas.
  const ferramentasDeclaradas = contexto.ferramentasDeclaradas ?? [];
  const ferramentasGeracao = (FERRAMENTA_GERACAO_POR_AGENTE[agenteId] ?? []).filter((f) => {
    if (buscarFerramenta(f.tool.name).riskLevel === "low") return true;
    if (ferramentasDeclaradas.includes(f.tool.name)) return true;
    return ferramentasDeclaradas.some((nome) => ALIAS_FERRAMENTA_GERACAO[nome]?.includes(f.tool.name));
  });

  let response: Anthropic.Message;
  let midiaGerada: ResultadoTurnoExecucao["midiaGerada"];
  let ferramentaUsada: FerramentaDeExecucao | undefined;
  let imagemIndisponivel = false;

  interface ArtefatoBruto {
    type: string;
    title: string;
    content: string;
    periodo?: string;
    calendario?: Array<{ data: string; titulo: string; canal?: string; tipo?: string }>;
    indicadores?: string[];
    rota?: RotaEstrategica;
  }
  // Preenchido só quando o modelo usa a ferramenta entregar_documento no
  // turno intermediário (ver bloco abaixo) — mesclado em bruto.artifacts
  // depois, independente do que o modelo tenha (ou não) repetido dentro
  // de entregar_resultado.artifacts.
  let documentoForcado: ArtefatoBruto | undefined;

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
    imagemIndisponivel = !!resultadoExecucao.imagemIndisponivel;
  } else {
    // Achado real (prova do Planejamento, Fase 3, 4 execuções reais em
    // produção): oferecer `artifacts` como campo opcional dentro de
    // entregar_resultado nunca foi suficiente — o modelo repetidamente
    // preferiu escrever um `summary` convincente em prosa e pular o array
    // aninhado, mesmo com prompt reforçado e um turno de rascunho antes.
    // Fix mecânico: um turno intermediário oferece DUAS ferramentas
    // (entregar_resultado OU entregar_documento) com tool_choice "any" —
    // força ALGUMA chamada de ferramenta (nunca texto livre), e se o
    // modelo escolher entregar_documento, o schema dessa ferramenta NÃO
    // TEM campo de resumo — o único jeito de respondê-la é preencher o
    // documento de verdade. O turno final sempre fecha com
    // entregar_resultado normal.
    const mensagensRascunho: Anthropic.MessageParam[] = [
      {
        role: "user",
        content:
          `${contexto.etapaTarefa}\n\nAntes de entregar o resultado formal, escreva em texto livre TODO o conteúdo real que ` +
          `você vai entregar. Se for um documento/plano/calendário, escreva cada item já no formato final (data, título, canal, ` +
          `cada indicador com métrica e meta) — não só um resumo narrativo. No próximo passo você só vai copiar isso pro formato ` +
          `estruturado, então escreva aqui o conteúdo completo, não uma versão resumida. IMPORTANTE: completo não é sinônimo de ` +
          `exaustivo — é um documento PRÁTICO pra alguém executar, não um relatório de consultoria. Evite repetir a mesma coisa ` +
          `de formas diferentes, roteiro segundo-a-segundo, ou detalhar excessivamente cada item; poucas frases objetivas por ` +
          `item já bastam. Este rascunho todo precisa caber em poucos parágrafos, não múltiplas páginas.`,
      },
    ];
    const rascunho = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: mensagensRascunho,
    });
    const textoRascunho = rascunho.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Achado real (5 execuções reais em produção): oferecer entregar_documento
    // como ESCOLHA (junto de entregar_resultado, tool_choice "any") não
    // bastou — o modelo repetidamente escolhia só entregar_resultado, com
    // um summary bem escrito, mesmo sabendo que a tarefa pedia um documento.
    // Quando o orchestrator já sabe estruturalmente que esta é a etapa
    // terminal de estrategia (contexto.exigeDocumento), nem oferece a
    // escolha — força entregar_documento direto, sem escape.
    const mensagensEscolha: Anthropic.MessageParam[] = [
      ...mensagensRascunho,
      { role: "assistant", content: textoRascunho || "(sem conteúdo — nada a estruturar)" },
      {
        role: "user",
        content: contexto.exigeDocumento
          ? "Esta etapa PRECISA entregar um documento real. Use entregar_documento agora com o conteúdo completo do texto " +
            "acima (calendario/indicadores reais, copiados item por item, nunca resumidos) — mas mantenha CONCISO e prático: " +
            "não expanda além do que já está no rascunho, não adicione roteiro segundo-a-segundo nem repita a mesma informação " +
            "de formas diferentes. O campo content tem espaço limitado — se estourar, o documento inteiro é perdido, então " +
            "prefira objetividade a exaustividade."
          : "Se o texto acima é um documento/plano/calendário real que você deve ENTREGAR como artefato salvo (não só uma " +
            "análise interna), use entregar_documento agora com o conteúdo completo (calendario/indicadores reais, copiados do " +
            "texto acima), mantendo conciso e prático — sem expandir além do rascunho. Se esta etapa é só uma análise/decisão " +
            "sem documento pra salvar, use entregar_resultado diretamente.",
      },
    ];
    // max_tokens generoso (8192) — achado real (prova em produção, missão
    // Dog King Cambé 19/08): com 2048 aqui, um documento real (calendário +
    // KPIs + briefings de 5 ações) estourava o limite ANTES do campo
    // `content` de entregar_documento terminar de ser gerado — o tool_use
    // truncado saía sem `content` (ou vazio), o item era descartado
    // silenciosamente pelo filtro `!item.content?.trim()` mais abaixo, e a
    // etapa terminal fechava sem nenhum artifact real mesmo com o
    // tool_choice forçado funcionando exatamente como esperado.
    const escolha = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages: mensagensEscolha,
      tools: contexto.exigeDocumento ? [ENTREGAR_DOCUMENTO_TOOL] : [ENTREGAR_RESULTADO_TOOL, ENTREGAR_DOCUMENTO_TOOL],
      tool_choice: contexto.exigeDocumento ? { type: "tool", name: "entregar_documento" } : { type: "any" },
    });
    if (escolha.stop_reason === "max_tokens") {
      console.warn(`[specialistRunner] turno de entregar_documento truncado por max_tokens (etapa ${missionStepId}) — documento pode ter saído incompleto.`);
    }

    const chamadaDocumento = escolha.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "entregar_documento",
    );
    const chamadaResultadoDireta = escolha.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "entregar_resultado",
    );

    if (chamadaResultadoDireta && !chamadaDocumento) {
      // Etapa sem documento a entregar — o modelo já fechou direto.
      response = escolha;
    } else if (chamadaDocumento) {
      documentoForcado = chamadaDocumento.input as ArtefatoBruto;
      // Cada tool_use do turno anterior precisa de um tool_result antes do
      // próximo turno (exigência da API) — normalmente só entregar_documento
      // aparece aqui, mas se o modelo chamou as duas na mesma resposta,
      // resolve as duas pra nunca deixar um tool_use pendente (o que
      // derrubaria a chamada inteira com erro 400).
      const resultadosPendentes: Anthropic.ToolResultBlockParam[] = [
        { type: "tool_result", tool_use_id: chamadaDocumento.id, content: `Documento "${documentoForcado.title}" recebido e será salvo como artefato real.` },
      ];
      if (chamadaResultadoDireta) {
        resultadosPendentes.push({
          type: "tool_result",
          tool_use_id: chamadaResultadoDireta.id,
          content: "Ignorado — o fechamento final desta etapa será pedido de novo no próximo turno, depois do documento.",
        });
      }
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [...mensagensEscolha, { role: "assistant", content: escolha.content }, { role: "user", content: resultadosPendentes }],
        tools: [ENTREGAR_RESULTADO_TOOL],
        tool_choice: { type: "tool", name: "entregar_resultado" },
      });
    } else {
      // Nem entregar_documento nem entregar_resultado vieram (não deveria
      // acontecer com tool_choice "any", mas nunca assume sucesso sem
      // verificar) — força o fechamento normal.
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [...mensagensEscolha, { role: "assistant", content: escolha.content }],
        tools: [ENTREGAR_RESULTADO_TOOL],
        tool_choice: { type: "tool", name: "entregar_resultado" },
      });
    }
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "entregar_resultado",
  );

  const bruto = (toolUse?.input ?? {}) as Partial<AgentResult> & { artifacts?: ArtefatoBruto[] };
  // Nunca reatribui bruto.artifacts (o tipo dele vem de AgentResult, que já
  // usa ArtefatoPersistido — reatribuir um ArtefatoBruto ali quebraria o
  // tipo); mescla numa variável própria em vez disso.
  const artefatosBrutos: ArtefatoBruto[] = [...(bruto.artifacts ?? []), ...(documentoForcado ? [documentoForcado] : [])];

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
          const canvasJson =
            midiaGerada.canvasInfo.canvasJsonPronto ??
            montarCanvasJsonInicial({
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

  // Artefatos de texto declarados pelo modelo (+ o documento forçado via
  // entregar_documento, se houver) — só os tipos permitidos no schema
  // chegam aqui, mas revalida no código mesmo assim (nunca confiar só no
  // schema da API de tool use).
  for (const item of artefatosBrutos) {
    if (!(TIPOS_ARTEFATO_TEXTO as readonly string[]).includes(item.type) || !item.content?.trim()) {
      // Descarte silencioso demais no passado (etapa fechava sem artifact e
      // sem nenhum rastro do motivo) — acontecia sobretudo quando o turno
      // de entregar_documento truncava por max_tokens antes do campo
      // `content` sair completo. Loga pra nunca mais precisar investigar
      // isso só via SQL direto em produção.
      console.warn(
        `[specialistRunner] artefato descartado na etapa ${missionStepId}: type="${item?.type}" title="${item?.title}" content vazio/tipo inválido.`,
      );
      continue;
    }
    // Rota Estratégica: mesmo quando o modelo preencheu rota.performance,
    // o valor que persiste é sempre recalculado aqui a partir do dado real
    // já sincronizado (contexto.trafego) — nunca o número que o LLM
    // escreveu. rotaEstrategicaValida rejeita uma Rota capenga (só
    // título/lede sem os blocos que dão sustância ao formato): nesse caso
    // cai de volta pro plano de texto simples em vez de persistir um
    // formato prometido pela metade.
    const rotaValida = item.type === "plan" && rotaEstrategicaValida(item.rota) ? item.rota : undefined;
    const rotaComPerformanceReal =
      rotaValida && contexto.trafego?.contaConectada
        ? {
            ...rotaValida,
            performance: {
              linhas: montarPerformanceLinhas(contexto.trafego.campanhas.map((c) => ({ nome: c.nome, metricas: c.metricas as never }))),
              leitura: rotaValida.performance?.leitura ?? "",
            },
          }
        : rotaValida;

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
              ? {
                  periodo: item.periodo,
                  calendario: item.calendario ?? [],
                  indicadores: item.indicadores ?? [],
                  ...(rotaComPerformanceReal ? { formato: "rota_estrategica", rota: rotaComPerformanceReal } : {}),
                }
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
    ...(imagemIndisponivel ? { imagemIndisponivel: true } : {}),
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

  const { custoEstimadoCentavos, motivoAusencia } = calcularCustoEstimadoCentavos({
    modelo: response.model,
    tokensEntrada: response.usage.input_tokens,
    tokensSaida: response.usage.output_tokens,
  });

  await supabase.from("agent_runs").insert({
    mission_step_id: missionStepId,
    cliente_id: clienteId,
    agente: agenteId,
    modelo: response.model,
    tokens_entrada: response.usage.input_tokens,
    tokens_saida: response.usage.output_tokens,
    custo_estimado_centavos: custoEstimadoCentavos,
    custo_motivo_ausencia: motivoAusencia,
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
