// Design profissional (Parte 1) — cria o design_project editável a partir
// de uma geração real do agente de Design. Nunca substitui o artifact
// (PNG final, entrega read-only) — o design_project é a CAMADA EDITÁVEL em
// cima dele, com a imagem gerada como fundo e a logo oficial (quando
// aplicada) como um objeto travado.
//
// canvasJson é montado à mão aqui (backend Node, sem fabric.js instalado —
// é uma dependência só de navegador) seguindo o schema que o Fabric.js
// espera ao carregar (toObject()/loadFromJSON() simétricos): cada objeto
// tem os campos padrão de imagem (type/left/top/scaleX/scaleY/originX/
// originY) + o metadado custom `vetorMeta` que o editor no painel já sabe
// ler (ver apps/painel/src/lib/design/types.ts). NUNCA grava a URL
// assinada aqui dentro — grava só o caminho real do storage
// (vetorMeta.storagePath); o editor no painel re-assina na hora de abrir o
// projeto (URL assinada expira, o storage_path não).

import { supabase } from "../db/supabase.js";

export interface DimensaoImagem {
  width: number;
  height: number;
}

export function dimensaoDoTamanhoOpenAI(tamanho: string): DimensaoImagem {
  const [width, height] = tamanho.split("x").map(Number);
  return { width: width || 1024, height: height || 1024 };
}

interface ObjetoDeImagemCanvas {
  type: "image";
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  originX: "left";
  originY: "top";
  selectable: boolean;
  lockMovementX?: boolean;
  lockMovementY?: boolean;
  lockScalingX?: boolean;
  lockScalingY?: boolean;
  lockRotation?: boolean;
  hasControls?: boolean;
  editable?: boolean;
  vetorMeta: {
    role: "fundo" | "logo" | "produto" | "pessoa" | "elemento";
    storagePath: string;
    bucket: "artifacts" | "brand-assets";
    isOfficialLogo?: boolean;
    assetId?: string;
  };
}

interface MontarCanvasParams {
  fundo: { storagePath: string; bucket: "artifacts"; naturalWidth: number; naturalHeight: number };
  canvasWidth: number;
  canvasHeight: number;
  logo?: { assetId: string; storagePath: string; naturalWidth?: number; naturalHeight?: number };
}

// Monta o canvasJson inicial de um design_project: a imagem gerada ocupa o
// canvas inteiro (fundo real, não um placeholder), a logo — quando
// aplicada pelo gerar_imagem — entra como um segundo objeto, travada por
// padrão (vetorMeta.isOfficialLogo), num canto com tamanho proporcional
// nunca maior que 20% da largura do canvas.
export function montarCanvasJsonInicial(params: MontarCanvasParams): unknown {
  const objetos: ObjetoDeImagemCanvas[] = [
    {
      type: "image",
      left: 0,
      top: 0,
      width: params.fundo.naturalWidth,
      height: params.fundo.naturalHeight,
      scaleX: params.canvasWidth / params.fundo.naturalWidth,
      scaleY: params.canvasHeight / params.fundo.naturalHeight,
      originX: "left",
      originY: "top",
      selectable: true,
      vetorMeta: { role: "fundo", storagePath: params.fundo.storagePath, bucket: "artifacts" },
    },
  ];

  if (params.logo) {
    const larguraLogo = Math.round(params.canvasWidth * 0.18);
    const alturaNatural = params.logo.naturalHeight ?? params.logo.naturalWidth ?? 1;
    const larguraNatural = params.logo.naturalWidth ?? 1;
    const alturaLogo = Math.round(larguraLogo * (alturaNatural / larguraNatural));
    const margem = Math.round(params.canvasWidth * 0.04);

    objetos.push({
      type: "image",
      left: params.canvasWidth - larguraLogo - margem,
      top: params.canvasHeight - alturaLogo - margem,
      width: larguraNatural,
      height: alturaNatural,
      scaleX: larguraLogo / larguraNatural,
      scaleY: alturaLogo / alturaNatural,
      originX: "left",
      originY: "top",
      selectable: true,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hasControls: false,
      editable: false,
      vetorMeta: {
        role: "logo",
        storagePath: params.logo.storagePath,
        bucket: "brand-assets",
        isOfficialLogo: true,
        assetId: params.logo.assetId,
      },
    });
  }

  return { version: "7.4.0", background: "#ffffff", objects: objetos };
}

export interface CriarDesignProjectParams {
  clienteId: string;
  missionId?: string;
  missionStepId?: string;
  solicitacaoId?: string;
  artifactId?: string;
  title: string;
  width: number;
  height: number;
  canvasJson: unknown;
  sourceAssetIds: string[];
  logoAssetId?: string;
  referenceAssetIds?: string[];
  brandValidation?: { passed: boolean; issues: string[] };
  designBrief?: string;
}

// Insert de verdade — apps/agentes usa a chave service_role (bypassa RLS),
// mesmo caminho que persistirArtefato() já usa pra escrever em artifacts.
export async function criarDesignProject(params: CriarDesignProjectParams): Promise<{ id: string; version: number }> {
  const { data, error } = await supabase
    .from("design_projects")
    .insert({
      cliente_id: params.clienteId,
      mission_id: params.missionId ?? null,
      mission_step_id: params.missionStepId ?? null,
      solicitacao_id: params.solicitacaoId ?? null,
      artifact_id: params.artifactId ?? null,
      title: params.title,
      width: params.width,
      height: params.height,
      canvas_json: params.canvasJson,
      version: 1,
      status: "awaiting_approval",
      source_asset_ids: params.sourceAssetIds,
      logo_asset_id: params.logoAssetId ?? null,
      reference_asset_ids: params.referenceAssetIds ?? [],
      brand_validation: params.brandValidation ?? null,
      design_brief: params.designBrief ?? null,
    })
    .select("id, version")
    .single();

  if (error || !data) throw new Error(`Falha ao criar design_project: ${error?.message}`);
  return { id: data.id as string, version: data.version as number };
}
