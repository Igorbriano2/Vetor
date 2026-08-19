// ProviderRouter interno (Parte 6) — núcleo genérico e puro (sem I/O real
// aqui, só orquestra funções que quem chama fornece) pra rotear uma
// chamada entre múltiplos provedores reais da mesma capacidade (TTS, e no
// futuro STT/imagem/vídeo/LLM quando existir mais de um provedor real
// configurado). Antes desta peça, cada integração (tts.ts, imageProvider.ts,
// transcricao.ts...) tinha sua própria ramificação por env var, sem
// nenhum fallback: se o provedor escolhido falhasse na hora H (fora do ar,
// cota estourada), a chamada inteira falhava, mesmo com um segundo provedor
// real e configurado disponível. Este módulo centraliza esse comportamento
// uma única vez, testável sem depender de nenhum provedor de verdade.

export interface ProvedorRegistrado<TInput, TOutput> {
  nome: string;
  // Checagem síncrona e barata (variáveis de ambiente presentes) — nunca
  // uma chamada de rede. Decide só se VALE tentar este provedor, não se ele
  // vai funcionar de fato (isso só se sabe chamando executar()).
  disponivel: () => boolean;
  executar: (input: TInput) => Promise<TOutput>;
}

export interface TentativaProvedor {
  provedor: string;
  // Ausente quando a tentativa nem chegou a rodar (disponivel() === false).
  erro?: string;
}

export class TodosOsProvedoresFalharamError extends Error {
  constructor(public readonly tentativas: TentativaProvedor[]) {
    super(
      `Todos os provedores falharam ou estão indisponíveis: ${tentativas
        .map((t) => `${t.provedor}${t.erro ? ` (${t.erro})` : " (indisponível)"}`)
        .join(", ")}`,
    );
    this.name = "TodosOsProvedoresFalharamError";
  }
}

export interface ResultadoRouter<TOutput> {
  resultado: TOutput;
  // Qual provedor de fato respondeu — nunca escondido do chamador, importante
  // pra log/observabilidade (ex: saber que a voz saiu no fallback genérico
  // em vez da voz clonada do cliente).
  provedorUsado: string;
  tentativas: TentativaProvedor[];
}

// Tenta cada provedor da lista, NA ORDEM dada (quem monta a lista decide a
// preferência) — pula os indisponíveis sem tentar de verdade, executa o
// primeiro disponível e só cai pro próximo se a chamada real falhar. Nunca
// silencioso: quando tudo falha, o erro final carrega TODAS as tentativas
// (nunca só "deu erro", sempre "provedor X falhou com Y, provedor Z estava
// indisponível porque W").
export async function executarComFallback<TInput, TOutput>(
  provedores: Array<ProvedorRegistrado<TInput, TOutput>>,
  input: TInput,
): Promise<ResultadoRouter<TOutput>> {
  const tentativas: TentativaProvedor[] = [];

  for (const provedor of provedores) {
    if (!provedor.disponivel()) {
      tentativas.push({ provedor: provedor.nome, erro: "indisponível (não configurado)" });
      continue;
    }
    try {
      const resultado = await provedor.executar(input);
      return { resultado, provedorUsado: provedor.nome, tentativas };
    } catch (err) {
      tentativas.push({ provedor: provedor.nome, erro: err instanceof Error ? err.message : "erro desconhecido" });
    }
  }

  throw new TodosOsProvedoresFalharamError(tentativas);
}
