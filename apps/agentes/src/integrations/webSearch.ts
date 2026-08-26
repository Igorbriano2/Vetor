// Pesquisa web real pro Agente de Estratégia/Growth (Fase A do prompt de
// reconstrução, docs/AUDITORIA-E-PROMPT-RECONSTRUCAO-2026-08.md Parte 1
// item 2) — até esta rodada, o diagnóstico de mercado na Rota Estratégica
// vinha só do que o LLM já sabia. Tavily porque a API já devolve resultado
// limpo pra consumo de LLM (sem parsing de HTML).
//
// Fail-closed por design: sem TAVILY_API_KEY configurada, lança erro claro
// em vez de devolver resultado vazio/simulado — o especialista precisa
// saber que a pesquisa não rodou, nunca tratar ausência de chave como
// "sem resultados encontrados".

export class PesquisaWebIndisponivelError extends Error {}

export interface ResultadoDePesquisa {
  titulo: string;
  url: string;
  resumo: string;
}

export interface RespostaDePesquisa {
  query: string;
  respostaDireta?: string;
  resultados: ResultadoDePesquisa[];
}

interface TavilyApiResponse {
  answer?: string;
  results?: Array<{ title?: string; url?: string; content?: string }>;
}

export async function pesquisarMercado(query: string): Promise<RespostaDePesquisa> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new PesquisaWebIndisponivelError(
      "Pesquisa web não configurada — falta TAVILY_API_KEY nas variáveis de ambiente.",
    );
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!res.ok) {
    throw new PesquisaWebIndisponivelError(`Tavily respondeu ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const dados = (await res.json()) as TavilyApiResponse;
  return {
    query,
    respostaDireta: dados.answer,
    resultados: (dados.results ?? [])
      .filter((r) => r.title && r.url)
      .map((r) => ({ titulo: r.title!, url: r.url!, resumo: r.content ?? "" })),
  };
}
