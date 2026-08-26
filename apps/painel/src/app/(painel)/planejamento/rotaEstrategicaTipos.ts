// Espelha apps/agentes/src/negocio/rotaEstrategica.ts (RotaEstrategica) —
// mesmo padrão já usado no resto do painel pra artifacts.metadata (ex:
// CalendarioItem local em page.tsx): o painel não importa tipos de
// apps/agentes (workspaces separados, sem pacote compartilhado em uso),
// então o shape é duplicado aqui, não uma dependência cruzada nova.

export interface RotaEstrategicaStat {
  label: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}

export interface RotaEstrategicaKpi {
  label: string;
  valor: string;
  contexto?: string;
  alerta?: boolean;
}

export interface RotaEstrategicaPerformanceLinha {
  nome: string;
  objetivo?: string;
  gasto: string;
  resultados: string;
  custoResultado: string;
  leitura: string;
  status: "good" | "warn" | "critical";
}

export interface RotaEstrategica {
  eyebrow?: string;
  titulo: string;
  lede: string;
  kpis: RotaEstrategicaKpi[];
  diagnostico: {
    resumo: string;
    stats: RotaEstrategicaStat[];
    porQueImporta?: string;
  };
  mercado?: {
    resumo: string;
    stats: RotaEstrategicaStat[];
  };
  empresa?: {
    resumo: string;
    endereco?: string;
    horarios?: string;
    canais?: string[];
  };
  performance?: {
    linhas: RotaEstrategicaPerformanceLinha[];
    leitura: string;
  };
  estrategia: Array<{
    kicker: string;
    titulo: string;
    descricao: string;
    investimentoSemana: string;
  }>;
  plano: Array<{
    numero: number;
    data: string;
    fase: string;
    totalDia: string;
    splitPorCampanha: number[];
    acoes: string[];
    climax?: boolean;
  }>;
  checklist: Array<{
    titulo: string;
    descricao: string;
    critico?: boolean;
  }>;
  metricas: Array<{
    nome: string;
    contexto: string;
    meta: string;
  }>;
}
