// Tipos do projeto de Design editável (canvas versionado) — espelha o shape
// pedido na spec, adaptado às convenções do repo (camelCase, cliente_id
// mapeado como tenantId aqui só na borda TS, a coluna real no banco é
// cliente_id como todo o resto do schema).
//
// canvasJson é sempre o retorno de Fabric.js `canvas.toJSON([...campos
// customizados])` — nunca um formato próprio nosso, pra evitar reinventar
// serialização de objeto de canvas.

export type DesignProjectStatus = "draft" | "awaiting_approval" | "approved" | "archived";

export interface DesignProject {
  id: string;
  tenantId: string;
  missionId?: string;
  requestId?: string;
  title: string;
  width: number;
  height: number;
  canvasJson: unknown;
  version: number;
  status: DesignProjectStatus;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Metadado customizado que gravamos em CADA objeto Fabric (via
// `object.set("vetorMeta", {...})`, incluído no toJSON por listar
// "vetorMeta" nas propriedades extras do serialize) — é assim que
// "logo bloqueada por padrão" sobrevive ao round-trip de JSON: não é uma
// convenção implícita, é um campo explícito por objeto.
export interface VetorObjectMeta {
  // Presente só nos objetos que representam a logo oficial aplicada
  // automaticamente (ver businessAssets.ts::buscarLogoParaFormato) — nunca
  // setado pelo usuário diretamente.
  assetId?: string;
  isOfficialLogo?: boolean;
  role?: "logo" | "produto" | "pessoa" | "fundo" | "texto" | "elemento";
}

export const CAMPOS_EXTRAS_SERIALIZACAO = ["vetorMeta"] as const;
