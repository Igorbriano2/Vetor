// Pós-build: garante que `sharp` (marcado --external no esbuild, único
// pacote do grafo de dependências que precisa existir fisicamente em
// node_modules em runtime — os demais vão embutidos no bundle) esteja
// dentro de apps/agentes/node_modules, não só na raiz do monorepo.
//
// Achado em produção: com npm workspaces, `npm install` roda a partir de
// apps/agentes mas hospeda (hoist) `sharp` só em <raiz>/node_modules. O
// buildpack da DigitalOcean empacota como imagem final SÓ o diretório
// apps/agentes — o node_modules hoisted da raiz fica de fora, e
// `node dist/worker.js` quebra com ERR_MODULE_NOT_FOUND em runtime, mesmo
// o build tendo passado limpo (esbuild --external nunca precisa carregar o
// binário de verdade, só deixa o import intocado no bundle).
//
// `install-strategy=nested` num .npmrc de apps/agentes NÃO resolve isso —
// npm ignora config de install-strategy em .npmrc de membro de workspace
// (warning: "ignoring workspace config"), só funciona na raiz do monorepo,
// e mudar a raiz afetaria o layout de node_modules de todo o monorepo. Por
// isso a correção é local a este app: copiar sharp e TODA a árvore de
// dependências dele (percorrida de verdade a partir do package.json de
// cada pacote, não uma lista fixa — a 1ª tentativa só copiou os
// optionalDependencies de plataforma e quebrou de novo em produção
// faltando a dependência regular @img/colour) pra dentro de
// apps/agentes/node_modules antes do buildpack capturar a camada da app.

import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");
const destNodeModules = join(appDir, "node_modules");

const erros = [];

// Não usamos require.resolve('sharp') aqui de propósito: depois da
// primeira cópia, apps/agentes/node_modules/sharp já existe e passaria a
// ser resolvido primeiro (Node prioriza o node_modules mais próximo),
// mascarando de onde a árvore de verdade deveria vir. Em vez disso subimos
// manualmente a partir do diretório PAI de apps/agentes — nunca aceitamos
// o próprio destino como origem — até achar um node_modules que realmente
// tenha sharp instalado (local a outro workspace ou hoisted na raiz do
// monorepo).
function encontrarNodeModulesComSharp(dirInicial) {
  let dir = dirInicial;
  while (true) {
    const candidato = join(dir, "node_modules", "sharp", "package.json");
    if (existsSync(candidato)) return join(dir, "node_modules");
    const pai = dirname(dir);
    if (pai === dir) return null;
    dir = pai;
  }
}

function caminhoDoPacote(nodeModulesDir, nomePacote) {
  return join(nodeModulesDir, ...nomePacote.split("/"));
}

const origemNodeModules = encontrarNodeModulesComSharp(dirname(appDir));
if (!origemNodeModules) {
  erros.push("não achei nenhum node_modules/sharp em nenhum ancestral de apps/agentes — rode `npm install` antes do build.");
}

if (origemNodeModules) {
  // BFS pela árvore real de dependências do sharp (lida do package.json de
  // cada pacote, não hardcoded), copiando cada um pra apps/agentes/node_modules.
  // optionalDependencies de plataforma (@img/sharp-<so>-<arch>) que não
  // batem com a máquina atual simplesmente não existem na origem — isso é
  // esperado e não é erro; só dependencies regulares ausentes são erro.
  const obrigatorio = new Map(); // nome -> true (obrigatório em algum caminho) | false (só visto como opcional até agora)
  const fila = [{ nome: "sharp", obrigatorio: true }];
  const copiados = [];

  while (fila.length > 0) {
    const { nome, obrigatorio: viaObrigatoria } = fila.shift();
    const jaVisto = obrigatorio.has(nome);
    if (jaVisto && (obrigatorio.get(nome) || !viaObrigatoria)) continue;
    obrigatorio.set(nome, viaObrigatoria || (obrigatorio.get(nome) ?? false));

    const origemPkg = caminhoDoPacote(origemNodeModules, nome);
    const pkgJsonOrigem = join(origemPkg, "package.json");
    if (!existsSync(pkgJsonOrigem)) {
      if (viaObrigatoria) erros.push(`dependência obrigatória '${nome}' não existe em ${origemNodeModules} — instalação incompleta.`);
      continue; // opcional ausente (ex: binário de outra plataforma) — esperado, não é erro.
    }

    const destinoPkg = caminhoDoPacote(destNodeModules, nome);
    if (!existsSync(destinoPkg)) {
      mkdirSync(dirname(destinoPkg), { recursive: true });
      cpSync(origemPkg, destinoPkg, { recursive: true });
      copiados.push(nome);
    }

    const pkg = JSON.parse(readFileSync(pkgJsonOrigem, "utf8"));
    for (const dep of Object.keys(pkg.dependencies ?? {})) fila.push({ nome: dep, obrigatorio: true });
    for (const dep of Object.keys(pkg.optionalDependencies ?? {})) fila.push({ nome: dep, obrigatorio: false });
  }

  if (copiados.length > 0) {
    console.log(`vendor-sharp-runtime: copiado(s) pra apps/agentes/node_modules: ${copiados.join(", ")}`);
  } else {
    console.log("vendor-sharp-runtime: árvore do sharp já está local em apps/agentes/node_modules, nada a copiar.");
  }

  const temBinarioDePlataforma = [...obrigatorio.keys()].some(
    (nome) => nome.startsWith("@img/sharp-") && existsSync(caminhoDoPacote(destNodeModules, nome)),
  );
  if (!temBinarioDePlataforma) {
    erros.push(
      "nenhum pacote @img/sharp-<plataforma> foi vendorizado — o binário nativo do sharp pra esta plataforma não foi instalado (verifique optionalDependencies/arquitetura), sharp não vai funcionar em runtime mesmo com o pacote JS presente.",
    );
  }
}

if (erros.length > 0) {
  console.error("vendor-sharp-runtime: falhou em garantir sharp local pro runtime:");
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log("vendor-sharp-runtime: ok — sharp e toda a árvore de dependências dele estão em apps/agentes/node_modules.");
