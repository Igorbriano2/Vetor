// Custo estimado por chamada de LLM em agent_runs — nunca inventa custo: só
// calcula quando o provider devolveu usage real (tokens_entrada/tokens_saida
// vindos direto da resposta da API, nunca estimados por caractere/heurística).
// Quando falta usage, o modelo é desconhecido, ou o usage veio inválido,
// devolve custoEstimadoCentavos=null + motivoAusencia preenchido — nunca um
// "0" ou um número que pareça real sem ser.
//
// Achado na FASE 0 de reconciliação (docs/STATUS-REAL-ATUAL.md, item 15): a
// coluna custo_estimado_centavos existe desde a migration 0004 mas nunca foi
// preenchida — response.usage (tokens reais) já estava disponível no call
// site, só faltava converter em custo.
//
// Limitação conhecida (documentar, não esconder): isso cobre só a última
// chamada anthropic.messages.create() do turno que gerou o agent_run — em
// fluxos com ferramenta de execução (ex: criar_peca_de_design), chamadas
// internas adicionais (DesignCritic, etc.) não são somadas aqui. Mesma
// limitação que tokens_entrada/tokens_saida já tinham antes desta mudança;
// somar o custo de toda a árvore de chamadas de uma etapa é escopo maior,
// fora desta rodada.

export interface PrecoPorModelo {
  usdPorMilhaoEntrada: number;
  usdPorMilhaoSaida: number;
}

// Preços públicos da Anthropic (USD por milhão de tokens, tier padrão,
// contexto <=200K). Única fonte usada nesta rodada — não existe API de preço
// em tempo real; se a Anthropic mudar o preço, atualizar aqui. Hoje só
// "claude-sonnet-4-5" é usado de verdade no código (grep confirmado na FASE 0),
// os outros ficam na tabela por segurança pra runs futuras/históricas.
//
// Achado no smoke test real desta fase: response.model devolve o snapshot
// DATADO ("claude-sonnet-4-5-20250929"), nunca o alias usado em `model:` na
// chamada — a chave aqui é o alias, e a busca abaixo compara por prefixo
// (startsWith), porque a Anthropic não muda preço entre snapshots datados do
// mesmo modelo nomeado, só entre gerações de modelo.
export const PRECOS_POR_MODELO: Record<string, PrecoPorModelo> = {
  "claude-sonnet-4-5": { usdPorMilhaoEntrada: 3, usdPorMilhaoSaida: 15 },
  "claude-opus-4-1": { usdPorMilhaoEntrada: 15, usdPorMilhaoSaida: 75 },
  "claude-haiku-4-5": { usdPorMilhaoEntrada: 1, usdPorMilhaoSaida: 5 },
};

function resolverPrecoPorModelo(modelo: string): PrecoPorModelo | undefined {
  const chaveExata = PRECOS_POR_MODELO[modelo];
  if (chaveExata) return chaveExata;
  const alias = Object.keys(PRECOS_POR_MODELO).find((a) => modelo.startsWith(a));
  return alias ? PRECOS_POR_MODELO[alias] : undefined;
}

// Câmbio USD->BRL usado só pra ESTIMATIVA interna de custo (nunca cobrança
// real do cliente — o cliente paga plano fixo, ver billing/planos.ts).
// Configurável via env porque câmbio muda de verdade; o default é um valor
// redondo razoável, não uma cotação ao vivo — documentar isso evita alguém
// achar que é preciso.
export const USD_BRL_CENTAVOS_POR_DOLAR_PADRAO = Number(process.env.USD_BRL_CENTAVOS_POR_DOLAR ?? "540"); // ~R$5,40 default

export interface ResultadoCustoAgentRun {
  custoEstimadoCentavos: number | null;
  motivoAusencia: string | null;
}

export function calcularCustoEstimadoCentavos(params: {
  modelo: string | null | undefined;
  tokensEntrada: number | null | undefined;
  tokensSaida: number | null | undefined;
  // Injetável só pra teste determinístico do câmbio sem mexer em process.env
  // no meio da suíte — em produção sempre usa o default lido do env uma vez.
  cambioUsdBrlCentavos?: number;
}): ResultadoCustoAgentRun {
  const { modelo, tokensEntrada, tokensSaida, cambioUsdBrlCentavos = USD_BRL_CENTAVOS_POR_DOLAR_PADRAO } = params;

  if (!modelo) {
    return { custoEstimadoCentavos: null, motivoAusencia: "modelo ausente na resposta do provider" };
  }
  if (tokensEntrada == null || tokensSaida == null) {
    return {
      custoEstimadoCentavos: null,
      motivoAusencia: "provider não devolveu usage (tokens_entrada/tokens_saida ausentes)",
    };
  }
  if (!Number.isFinite(tokensEntrada) || !Number.isFinite(tokensSaida) || tokensEntrada < 0 || tokensSaida < 0) {
    return {
      custoEstimadoCentavos: null,
      motivoAusencia: `usage inválido do provider (entrada=${tokensEntrada}, saida=${tokensSaida})`,
    };
  }

  const preco = resolverPrecoPorModelo(modelo);
  if (!preco) {
    return { custoEstimadoCentavos: null, motivoAusencia: `modelo "${modelo}" não está na tabela de preços conhecida` };
  }

  const usdEntrada = (tokensEntrada / 1_000_000) * preco.usdPorMilhaoEntrada;
  const usdSaida = (tokensSaida / 1_000_000) * preco.usdPorMilhaoSaida;
  const usdTotal = usdEntrada + usdSaida;
  const custoEstimadoCentavos = Math.round(usdTotal * cambioUsdBrlCentavos);

  return { custoEstimadoCentavos, motivoAusencia: null };
}
