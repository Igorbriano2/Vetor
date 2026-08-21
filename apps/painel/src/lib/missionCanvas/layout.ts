// Creative Mission Canvas (Fase 3 do upgrade Gravyx, Rodada D) — layout puro
// (sem React, sem I/O) que transforma mission_steps + depende_de num grafo
// visual. Deliberadamente NÃO cria uma tabela nova (creative_mission_graphs
// já foi descartada no risco documentado em docs/GRAVYX-UPGRADE-AUDIT.md):
// mission_steps continua a ÚNICA fonte de verdade de execução real (worker
// BullMQ, Policy Engine, aprovação); este layout é só uma VISUALIZAÇÃO
// derivada dela, nunca editável, nunca uma segunda fonte de verdade —
// exatamente como o prompt mestre do upgrade define o Canvas: opcional,
// não o modo principal de interação (isso continua sendo o chat).

export interface EtapaParaLayout {
  id: string;
  agente: string;
  tarefa: string;
  status: string;
  dependeDe: string[];
  // Fase 6 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — soma real
  // de agent_runs.custo_estimado_centavos pra esta etapa (pode ter mais de
  // uma chamada/retry). Undefined/null quando ainda não rodou nenhuma
  // chamada real — nunca mostrado como R$ 0,00 fabricado.
  custoEstimadoCentavos?: number | null;
}

export interface NoDoCanvas {
  id: string;
  agente: string;
  tarefa: string;
  status: string;
  x: number;
  y: number;
  dependeDe: string[];
  custoEstimadoCentavos?: number | null;
}

export interface ArestaDoCanvas {
  deId: string;
  paraId: string;
}

export interface LayoutDoCanvas {
  nos: NoDoCanvas[];
  arestas: ArestaDoCanvas[];
  largura: number;
  altura: number;
}

export const LARGURA_NO = 216;
export const ALTURA_NO = 92;
const GAP_X = 88;
const GAP_Y = 16;

// Nível de cada nó = 1 + o nível mais profundo das dependências reais dessa
// etapa (raiz = nível 0). Ignora depende_de que aponta pra um id fora do
// conjunto de etapas (nunca deveria acontecer, mas o layout não pode
// quebrar por causa disso). Guarda contra ciclo (também não deveria
// acontecer — mission_steps é sempre um DAG na prática — mas um layout
// nunca pode entrar em loop infinito por causa de um dado inesperado).
function calcularNiveis(etapas: EtapaParaLayout[]): Map<string, number> {
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const niveis = new Map<string, number>();
  const emProgresso = new Set<string>();

  function nivelDe(id: string): number {
    const jaCalculado = niveis.get(id);
    if (jaCalculado !== undefined) return jaCalculado;
    if (emProgresso.has(id)) return 0;

    emProgresso.add(id);
    const etapa = porId.get(id);
    const depsValidas = (etapa?.dependeDe ?? []).filter((d) => porId.has(d) && d !== id);
    const nivel = depsValidas.length === 0 ? 0 : Math.max(...depsValidas.map(nivelDe)) + 1;
    emProgresso.delete(id);
    niveis.set(id, nivel);
    return nivel;
  }

  for (const etapa of etapas) nivelDe(etapa.id);
  return niveis;
}

export function calcularLayoutDoCanvas(etapas: EtapaParaLayout[]): LayoutDoCanvas {
  if (etapas.length === 0) return { nos: [], arestas: [], largura: 0, altura: 0 };

  const porId = new Map(etapas.map((e) => [e.id, e]));
  const niveis = calcularNiveis(etapas);

  const idsPorNivel = new Map<number, string[]>();
  for (const etapa of etapas) {
    const nivel = niveis.get(etapa.id) ?? 0;
    if (!idsPorNivel.has(nivel)) idsPorNivel.set(nivel, []);
    idsPorNivel.get(nivel)!.push(etapa.id);
  }

  const nos: NoDoCanvas[] = [];
  const arestas: ArestaDoCanvas[] = [];
  const maxNivel = Math.max(...Array.from(idsPorNivel.keys()));
  let alturaMaxima = 0;

  for (let nivel = 0; nivel <= maxNivel; nivel++) {
    const ids = idsPorNivel.get(nivel) ?? [];
    ids.forEach((id, indice) => {
      const etapa = porId.get(id)!;
      const dependeDeValidas = etapa.dependeDe.filter((d) => porId.has(d) && d !== id);
      const x = nivel * (LARGURA_NO + GAP_X);
      const y = indice * (ALTURA_NO + GAP_Y);
      nos.push({
        id,
        agente: etapa.agente,
        tarefa: etapa.tarefa,
        status: etapa.status,
        x,
        y,
        dependeDe: dependeDeValidas,
        custoEstimadoCentavos: etapa.custoEstimadoCentavos,
      });
      for (const dep of dependeDeValidas) arestas.push({ deId: dep, paraId: id });
      alturaMaxima = Math.max(alturaMaxima, y + ALTURA_NO);
    });
  }

  return {
    nos,
    arestas,
    largura: (maxNivel + 1) * LARGURA_NO + maxNivel * GAP_X,
    altura: alturaMaxima,
  };
}
