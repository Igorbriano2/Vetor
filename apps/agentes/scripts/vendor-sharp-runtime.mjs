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
// isso a correção é local a este app: copiar o pacote já resolvido pelo
// npm (onde quer que ele esteja — local ou hoisted) pra dentro de
// apps/agentes/node_modules antes do buildpack capturar a camada da app.

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");
const destNodeModules = join(appDir, "node_modules");

const erros = [];

// Não usamos require.resolve('sharp') aqui de propósito: depois da
// primeira cópia, apps/agentes/node_modules/sharp já existe e passaria a
// ser resolvido primeiro (Node prioriza o node_modules mais próximo),
// mascarando de onde o @img/sharp-* de verdade deveria vir. Em vez disso
// subimos manualmente a partir do diretório PAI de apps/agentes — nunca
// aceitamos o próprio destino como origem — até achar um node_modules que
// realmente tenha sharp instalado (local a outro workspace ou hoisted na
// raiz do monorepo).
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

const origemNodeModules = encontrarNodeModulesComSharp(dirname(appDir));
const sharpDir = origemNodeModules ? join(origemNodeModules, "sharp") : null;

if (!sharpDir) {
  erros.push("não achei nenhum node_modules/sharp em nenhum ancestral de apps/agentes — rode `npm install` antes do build.");
}

if (sharpDir) {
  const sharpDestino = join(destNodeModules, "sharp");
  if (!existsSync(sharpDestino)) {
    mkdirSync(destNodeModules, { recursive: true });
    cpSync(sharpDir, sharpDestino, { recursive: true });
    console.log(`vendor-sharp-runtime: copiado ${sharpDir} -> ${sharpDestino}`);
  } else {
    console.log("vendor-sharp-runtime: sharp já está local em apps/agentes/node_modules, nada a copiar.");
  }

  // sharp usa optionalDependencies por plataforma (@img/sharp-<plataforma>,
  // @img/sharp-libvips-<plataforma>) — o npm só instala as que batem com o
  // SO/arquitetura de quem rodou o install, então o node_modules/@img de
  // origem só tem o que realmente é relevante pra essa máquina.
  const imgOrigemDir = join(dirname(sharpDir), "@img");
  const imgDestinoDir = join(destNodeModules, "@img");
  if (existsSync(imgOrigemDir)) {
    mkdirSync(imgDestinoDir, { recursive: true });
    const pacotesSharp = readdirSync(imgOrigemDir).filter((nome) => nome.startsWith("sharp-"));
    for (const pacote of pacotesSharp) {
      const origem = join(imgOrigemDir, pacote);
      const destino = join(imgDestinoDir, pacote);
      if (!existsSync(destino)) {
        cpSync(origem, destino, { recursive: true });
        console.log(`vendor-sharp-runtime: copiado @img/${pacote}`);
      }
    }
    if (pacotesSharp.length === 0) {
      erros.push(
        `@img/sharp-* não encontrado em ${imgOrigemDir} — o binário nativo da plataforma não foi instalado, sharp não vai funcionar em runtime mesmo com o pacote JS presente.`,
      );
    }
  } else {
    erros.push(`diretório @img esperado ao lado de node_modules/sharp não existe (${imgOrigemDir}).`);
  }
}

if (erros.length > 0) {
  console.error("vendor-sharp-runtime: falhou em garantir sharp local pro runtime:");
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log("vendor-sharp-runtime: ok — sharp e seu binário de plataforma estão em apps/agentes/node_modules.");
