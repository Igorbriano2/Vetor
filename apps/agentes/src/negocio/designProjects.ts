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

// Lê a dimensão real dos bytes da imagem (PNG/JPEG) — nunca confia em
// business_assets.width/height pra montar o canvas: achado ao vivo que
// ativos antigos (cadastrados antes da coluna existir) ficam com width/
// height nulos, e cair pra um fallback 1x1 força a logo pra uma caixa
// quadrada, DISTORCENDO ela (viola a regra "nunca distorce a logo" da
// spec). Decodifica direto dos bytes já baixados pra geração — sempre
// preciso, nunca depende de backfill.
export function lerDimensaoDeImagem(bytes: Buffer): DimensaoImagem | null {
  // PNG: assinatura de 8 bytes + chunk IHDR (width/height big-endian nos
  // bytes 16-23).
  const assinaturaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(assinaturaPng)) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  // JPEG: sequência de marcadores 0xFFxx; os marcadores SOF (Start Of
  // Frame, 0xC0–0xCF exceto 0xC4/0xC8/0xCC) carregam altura/largura logo
  // após o byte de precisão.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marcador = bytes[offset + 1];
      const ehSOF = marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
      if (ehSOF) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      const tamanhoSegmento = bytes.readUInt16BE(offset + 2);
      offset += 2 + tamanhoSegmento;
    }
  }

  return null;
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
  designCritic?: unknown;
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
      design_critic: params.designCritic ?? null,
    })
    .select("id, version")
    .single();

  if (error || !data) throw new Error(`Falha ao criar design_project: ${error?.message}`);
  return { id: data.id as string, version: data.version as number };
}

export interface ReferenciaAprovada {
  id: string;
  title: string;
  designBrief: string | null;
  width: number;
  height: number;
}

// Peças já aprovadas do MESMO tenant — usadas só como inspiração de
// composição/ritmo/hierarquia/tratamento/formato (nunca cópia literal, ver
// prompt em specialistRunner.ts que injeta isso pro Claude escrever o
// prompt da nova peça). Nunca cruza tenant: cliente_id é sempre exato, não
// aceita um id "parecido" de fora.
export async function buscarReferenciasAprovadas(clienteId: string, limite = 3): Promise<ReferenciaAprovada[]> {
  const { data } = await supabase
    .from("design_projects")
    .select("id, title, design_brief, width, height")
    .eq("cliente_id", clienteId)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (!data) return [];
  return data.map((d) => ({
    id: d.id as string,
    title: d.title as string,
    designBrief: d.design_brief as string | null,
    width: d.width as number,
    height: d.height as number,
  }));
}
