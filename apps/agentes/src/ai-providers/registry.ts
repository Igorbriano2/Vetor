import type { AIModel, AIProviderAdapter, GenerationRequest } from "./types.js";
import { MockAdapter } from "./mockAdapter.js";
import { FishAudioAdapter } from "./fishAudioAdapter.js";
import { AutoRouterPadrao } from "./autoRouter.js";

// Registro central de providers — Fish Audio (voz) é o primeiro provider
// real desta suíte (ver docs/arquitetura-suite-ia.md seção 4); imagem/
// vídeo/3D seguem no MockAdapter até ter chave da fal.ai/Replicate/etc.
// Adicionar o próximo provider real é só: 1) implementar o
// AIProviderAdapter novo, 2) registrar aqui, 3) marcar os AIModel dele
// como "featured"/"available" — nenhuma tela ou rota muda.
const ADAPTERS: AIProviderAdapter[] = [new MockAdapter(), new FishAudioAdapter()];

const roteador = new AutoRouterPadrao();

export async function listarTodosOsModelos(): Promise<AIModel[]> {
  const listas = await Promise.all(ADAPTERS.map((a) => a.listModels()));
  return listas.flat();
}

function buscarAdapterDoProvider(providerId: string): AIProviderAdapter {
  const adapter = ADAPTERS.find((a) => a.providerId === providerId);
  if (!adapter) throw new Error(`Nenhum adapter registrado pro provider "${providerId}".`);
  return adapter;
}

// Resolve o AIModel real a partir do pedido (explícito ou "auto") — usado
// por toda rota de geração antes de chamar generate(), nunca a rota decide
// o modelo sozinha.
export async function resolverModelo(request: GenerationRequest): Promise<AIModel> {
  const modelos = await listarTodosOsModelos();
  if (request.modelId === "auto") return roteador.pickModel(request, modelos);
  const modelo = modelos.find((m) => m.id === request.modelId);
  if (!modelo) throw new Error(`Modelo "${request.modelId}" não encontrado.`);
  return modelo;
}

export async function iniciarGeracao(request: GenerationRequest): Promise<{ jobId: string; modelo: AIModel }> {
  const modelo = await resolverModelo(request);
  const adapter = buscarAdapterDoProvider(modelo.providerId);
  const { jobId } = await adapter.generate(request, modelo);
  return { jobId, modelo };
}

export async function consultarStatusDoJob(providerId: string, jobId: string) {
  return buscarAdapterDoProvider(providerId).getJobStatus(jobId);
}
