// Design profissional V1 — fontes de marca reais, empacotadas junto com o
// app (apps/agentes/fonts/, licença OFL — Google Fonts) e carregadas via
// `fontfile` do sharp (aponta pro arquivo .ttf direto, sem depender de a
// fonte estar "instalada" no container — nenhuma dependência de
// fontconfig/apt-get, mesma lição do bug do sharp: qualquer coisa que
// precise existir fisicamente em runtime tem que estar dentro de
// apps/agentes, nunca fora).
//
// Em produção (bundle esbuild) __dirname aqui é apps/agentes/dist — um
// nível acima chega em apps/agentes/fonts. Em dev/test (rodando o .ts
// direto, sem bundle) __dirname é apps/agentes/src/negocio — dois níveis
// acima chega no mesmo lugar. Mesma pasta real nos dois casos (nunca uma
// cópia separada pra cada ambiente) — só o número de ".." muda porque o
// bundle achata a profundidade de diretório; testa os dois candidatos e
// usa o que existir de verdade.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANDIDATOS_PASTA_FONTES = [join(__dirname, "..", "fonts"), join(__dirname, "..", "..", "fonts")];
const PASTA_FONTES = CANDIDATOS_PASTA_FONTES.find((caminho) => existsSync(caminho)) ?? CANDIDATOS_PASTA_FONTES[0]!;

interface ParDePesos {
  regular: string;
  bold: string;
}

const FONTES_DISPONIVEIS: Record<string, ParDePesos> = {
  "Passion One": {
    regular: join(PASTA_FONTES, "PassionOne-Regular.ttf"),
    bold: join(PASTA_FONTES, "PassionOne-Bold.ttf"),
  },
  Rubik: {
    regular: join(PASTA_FONTES, "Rubik-Regular.ttf"),
    bold: join(PASTA_FONTES, "Rubik-Bold.ttf"),
  },
};

// Devolve o caminho absoluto do arquivo .ttf pra essa família+peso, ou
// undefined se a família não é uma das que empacotamos (nesse caso o
// renderizador cai pro alias genérico do Pango, exatamente o
// comportamento de hoje — nunca lança erro por fonte desconhecida).
export function resolverArquivoDeFonte(fontFamily: string, fontWeight: "normal" | "bold"): string | undefined {
  const par = FONTES_DISPONIVEIS[fontFamily];
  if (!par) return undefined;
  const caminho = fontWeight === "bold" ? par.bold : par.regular;
  return existsSync(caminho) ? caminho : undefined;
}
