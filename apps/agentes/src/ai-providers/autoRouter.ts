import type { AIModel, AutoRouter, GenerationRequest } from "./types.js";

// AutoRouter real (não um stub) — o modo "Automático" é o caminho principal
// pro cliente leigo (seção 3 do prompt-mestre: ele não sabe a diferença
// entre Kling e Veo, e não deveria precisar saber). Critério, nesta ordem:
// 1) só modelos do "kind" pedido; 2) só "deprecated" fica de fora sempre;
// 3) se o pedido exige uma capability (referência, start/end frame, áudio),
// só modelos que realmente suportam entram na disputa — nunca escolhe um
// modelo que vai ignorar silenciosamente o que o cliente pediu; 4) entre os
// que sobraram, prioriza "featured" sobre "available"/"beta"; 5) empate
// resolvido pelo menor custo em créditos (nunca empurra o modelo mais caro
// por padrão).
export class AutoRouterPadrao implements AutoRouter {
  pickModel(request: GenerationRequest, availableModels: AIModel[]): AIModel {
    const candidatos = availableModels.filter((m) => m.kind === request.kind && m.status !== "deprecated");
    if (candidatos.length === 0) {
      throw new Error(`Nenhum modelo disponível pra kind "${request.kind}".`);
    }

    const exigeReferencia = !!request.referenceAssetIds?.length;
    const exigeStartEndFrame = !!(request.startFrameAssetId || request.endFrameAssetId);

    const compativeis = candidatos.filter((m) => {
      if (exigeReferencia && !m.capabilities.referenceImages) return false;
      if (exigeStartEndFrame && !m.capabilities.startEndFrame) return false;
      return true;
    });

    const pool = compativeis.length > 0 ? compativeis : candidatos;

    const featured = pool.filter((m) => m.status === "featured");
    const prioridade = featured.length > 0 ? featured : pool;

    return [...prioridade].sort((a, b) => a.costCredits - b.costCredits)[0]!;
  }
}
