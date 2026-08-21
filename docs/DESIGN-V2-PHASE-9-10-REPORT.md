# Design V2 — Fases 9 e 10 (relatório de execução)

**Gerado em:** 2026-08-21
**Escopo do pedido:** Fase 9 (qualidade visual + ArtDirectionSpec real) e Fase 10 (testes E2E e
aceite), com plano detalhado aprovado previamente pelo usuário (`/Users/usuario1/.claude/plans/scalable-plotting-avalanche.md`).
**Restrição inegociável cumprida:** nenhuma chamada paga de geração de imagem/vídeo foi feita nesta
rodada. O smoke test real só acontece depois deste relatório ser aprovado.

---

## 1. O que foi implementado (Fase 9)

Todos os itens abaixo estão em produção (deploy confirmado na seção 3). Commits separados por peça de
trabalho, todos com `npm run build`/lint/test rodando limpo antes do commit.

### 1.1 ArtDirectionSpec — 6 estilos reais de layout (o núcleo da Fase 9)

Antes: `criar_peca_de_design` tinha **um único arranjo hardcoded** (headline no topo → imagem
centralizada → CTA canto inferior esquerdo → logo canto inferior direito), sempre o mesmo
independente do pedido.

Agora: `apps/agentes/src/negocio/artDirection.ts` — `EstiloArteDirecao` (6 valores),
`montarLayoutPorDirecao()` dispatcher, e 6 funções de layout genuinamente distintas:

| Estilo | Arranjo |
|---|---|
| `editorial` (padrão) | Extração **exata** do algoritmo antigo — zero mudança de comportamento pra quem não escolher estilo |
| `product_hero` | Produto ocupa ~65% da altura no topo; faixa sólida na base com headline/CTA |
| `split_screen` | Painel sólido à esquerda (texto); ativo do Drive à direita, escalado por "contain" (nunca "cover" — ver bug corrigido abaixo) |
| `collage` | 2+ ativos reais em blocos assimétricos; cai pro `editorial` com menos de 2 ativos (nunca finge uma colagem vazia) |
| `testimonial` | Headline tratado como citação, centralizado; foto da pessoa acima; atribuição abaixo |
| `minimal_authority` | Máximo de espaço negativo — logo pequeno, headline curto, uma linha fina de acento, sem CTA com forma de fundo |

Todos reaproveitam os helpers puros já existentes (`estimarAlturaDeTexto`, `validarAreaSegura`,
`corDeTextoPadrao`, `amostrarLuminanciaMedia`) — nenhuma lógica de contraste/geometria duplicada.

**Bug real encontrado e corrigido pelos testes**: o scaling "cover" original do `split_screen` podia
fazer o ativo do Drive sangrar por cima do painel de texto quando a proporção do ativo divergia muito
da região (ex: ativo quadrado numa metade retangular alta). Trocado por "contain" — nunca ultrapassa
os limites da região, mesmo com sobra de espaço.

### 1.2 `estilo_visual` ligado no fluxo real

- `CRIAR_PECA_DESIGN_TOOL.input_schema` ganhou o campo opcional `estilo_visual` (enum dos 6), mesmo
  padrão já usado pro campo `provider`.
- `executarCriarPecaDeDesign()` troca o bloco de layout inline por
  `montarLayoutPorDirecao(estilo, params)` — ~100 linhas de posicionamento centralizadas.
- `design.md` ganhou o guia de quando o agente deve escolher cada estilo.
- O prompt do DesignCritic recebe o estilo escolhido como contexto (sem novo critério — os 12 já
  existentes julgam com o padrão certo, ex: texto centralizado é esperado em `testimonial`).
- `CriarPecaWizard.tsx` ganhou um seletor "Estilo visual" (6 opções + "Deixar o Vetor decidir") que
  embute a preferência como frase no briefing — mesmo mecanismo conversacional do `provider`.
- `TemplatesPainel.tsx`/`DesignCommandCenter.tsx` propagam `estiloVisual` de `receita` (jsonb livre,
  sem migration) pra receitas visuais poderem sugerir um estilo.

### 1.3 Ação "Baixar" real

- `ArtifactLibrary.tsx` (Criações): link "baixar" ao lado de "abrir". Usa o parâmetro de query que o
  próprio Supabase Storage reconhece pra forçar `Content-Disposition: attachment` (mesmo efeito de
  `createSignedUrl({download:true})`) — um simples atributo `download` no `<a>` não funcionaria
  (ignorado pelo navegador em recursos cross-origin, e a URL assinada do Storage é sempre cross-origin).
- `DesignProjectEditor.tsx`: botão "Baixar PNG" no editor de camadas — `canvas.toDataURL()` +
  `<a download>` client-side, reaproveitando o mesmo `<canvas>` já montado.

### 1.4 Referências vira galeria de verdade

- **Modal de detalhe**: imagem, origem, autor real (`created_by → usuarios.nome`, resolvido em lote;
  item curado sem autor mostra "Curado pelo Vetor" em vez de inventar um nome), resumo simples da
  análise (quando existe), botão "Usar como inspiração".
- **4 coleções nomeadas navegáveis por abas**, cada uma com dado real por trás:
  - "Minhas referências" e "Curadas pelo Vetor" — já existiam como seções, viraram abas.
  - "Salvas" — campo `favorito` novo (migration `0035_reference_library_favorito.sql`, aplicada em
    produção), estrela no card e no modal, otimista com rollback em erro.
  - "Para esta campanha" — `reference_collections` não tem vínculo com `missions` no schema hoje;
    em vez de fingir essa ligação, mostra honestamente a coleção mais recente (nome real) com um
    estado vazio explícito quando não existe nenhuma. Confirmado ao vivo (seção 4).

---

## 2. O que foi implementado (Fase 10 — Track A, testes automatizados)

O repositório nunca teve Playwright/Cypress/CI (confirmado por investigação antes do plano — 0 de 47
arquivos de teste tocavam Supabase). Track A cobre o que é expressável sem navegador/Supabase real;
o resto é Track B (seção 4).

| Arquivo | Testes | Cobre |
|---|---|---|
| `apps/agentes/src/negocio/artDirection.test.ts` | 32 | Geometria real dos 6 layouts — dentro do canvas, logo sem duplicar, texto obrigatório nunca vazio, fallback do `collage`, contenção do `split_screen` |
| `apps/painel/src/lib/campanha/rotuloDePeca.test.ts` | 10 | Extraído de `ArtifactLibrary.tsx` — nunca confunde falha com "aguardando" (critério 11) |
| `apps/painel/src/lib/workspace/resolverClienteAtivo.test.ts` | 6 | Primeiro teste do repo com um Supabase client fake — isolamento de workspace: cliente comum nunca troca via cookie, admin só troca pra um `cliente_id` que existe de verdade (critério 15) |
| `apps/agentes/src/tools/registry.test.ts` (extensão) | +3 | `criar_peca_de_design`/`gerar_imagem`/`gerar_video_higgsfield` travados como `medium+` — nunca viram `low` por acidente (critério 7) |

**Resultado final**: 271 testes em `apps/agentes` (268 + 3), 88 em `apps/painel` (72 + 16) — todos
passando. Typecheck e lint limpos nos dois apps, em cada commit.

---

## 3. Deploy

5 commits enviados pro `main` (`5899c73` → `ba83766`), DigitalOcean App Platform (`deploy_on_push: true`
pros dois serviços) redeployou automaticamente:

- `agentes` (`api.vetormkt.online/health`) → `200`, confirmado após o build.
- `painel` (`painel.vetormkt.online`) → fingerprint de build (hash do chunk CSS) mudou de
  `2z3i3k8_88t8_.css` pra `35yuq79q0z6-7.css`, confirmando que o novo código está servindo.

Nenhuma migration nova nesta rodada além da `0035` (já aplicada antes do deploy).

---

## 4. Track B — roteiro de aceite ao vivo (Cantina da Ana / Vetor conta de teste)

Executado ao vivo em produção, autenticado como `admin_vetor`, alternando entre os workspaces
**Cantina da Ana** e **Vetor (conta de teste)** — o antigo "Dog King" foi renomeado/consolidado nessa
conta de teste; confirmado pelos dados reais (Dog Frango Duplo, brand kit com as mesmas cores
extraídas do brandbook).

**Salvaguarda operacional**: só o botão "Aprovar" de uma etapa de risco médio/alto (a que dispararia
geração paga de verdade) foi identificado e **nunca clicado**.

| # | Critério | Resultado |
|---|---|---|
| 1 | Home sem chat vazio | ✅ Saudação implícita, ações rápidas, entrada de texto/áudio, "Trabalhando em: ..." quando há missão ativa |
| 2 | Ações rápidas (Criar peça, vídeo, planejar, analisar, referência) | ✅ 6 botões reais na home, todos navegam/prefillam corretamente |
| 3 | Escolha uma receita/referência sem prompt técnico | ✅ Wizard de 4 passos, nenhum campo técnico obrigatório |
| 4 | Sistema coleta briefing sem exigir agente/skill | ✅ Mensagem em linguagem natural ("Crie uma peça de post de oferta... estilo product_hero") virou plano de missão automaticamente |
| 5 | Vetor monta plano compreensível | ✅ "Proposta de missão" com hipótese, critério de sucesso, etapas em português |
| 6 | Aprovação exigida antes de qualquer chamada paga | ✅ **Confirmado ao vivo**: etapa de Design nasceu com badge "AGUARDANDO SUA APROVAÇÃO" e botões reais Aprovar/Rejeitar — **não clicados** |
| 7 | Missão idempotente | ⚠️ Coberto parcialmente (hash já testado em `orchestrator.hash.test.ts`); execução completa fica como limitação conhecida (ver seção 5) |
| 8 | Criações/Planejamento/Negócio no workspace correto | ✅ Confirmado por troca de workspace: cada tenant mostrou dados completamente diferentes (Cantina da Ana vazio, "Vetor conta de teste" com o histórico real do Dog Frango Duplo) |
| 9 | Estados vazios com ação clara | ✅ Todas as telas vazias testadas (Criações, Design, Referências × 4 abas, Planejamento) têm frase explicando o que fazer, nunca um vazio mudo |
| 10 | Nenhum thumbnail falso | ✅ Card "Análise do Banco de Ativos" (tipo `document`) mostra rótulo "Documento", nunca finge ser imagem |
| 11 | Modo avançado nunca obrigatório | ✅ "Ver como canvas" é um `<details>` colapsado por padrão — o fluxo principal (chat → aprovação) não passa por ele |
| 12 | Design V1 com layers/editor funcionando | ⚠️ **Não verificado visualmente** — zero `design_projects` existem em toda a base de produção hoje (consulta SQL direta confirmou), então não havia projeto existente pra abrir sem gerar um novo (proibido). Coberto por revisão de código + typecheck/lint/testes; verificação visual fica pendente pro smoke test aprovado. |
| 13 | Rotas antigas por alias | ✅ `/dashboard` redireciona pra `/vetor` |
| 14 | RLS/isolamento de workspace | ✅ Confirmado ao vivo (isolamento entre tenants, seção 8 acima) + `resolverClienteAtivo.test.ts` |
| 15 | Estilo visual real (novo nesta rodada) | ✅ Seletor "Estilo visual" testado ao vivo no wizard — "Produto em destaque" selecionável; o Vetor reconheceu "product_hero" mencionado em texto livre no chat e o plano gerado citou "product hero" explicitamente |

---

## 5. Limitações conhecidas (honestas, não escondidas)

- **Critério 12 (Design V1 visual)**: não há nenhum `design_project` real em produção hoje — a
  verificação ao vivo do editor de camadas/botão "Baixar PNG" fica pendente até o primeiro smoke test
  real (que só roda depois da sua aprovação deste relatório).
- **"Para esta campanha"**: sem vínculo real entre `reference_collections` e `missions` no schema —
  mostra a coleção mais recente como fallback honesto. Se isso não for suficiente, uma migration
  aditiva (`reference_collections.mission_id`) resolveria de verdade numa próxima rodada.
- **Idempotência de missão (critério 7 completo)**: a cadeia de criação depende de Supabase real
  encadeado; não introduzi mocking de Supabase pela primeira vez nesta rodada só pra isso (escopo
  maior que o pedido).

---

## 6. Próximo passo

Com este relatório aprovado, o smoke test real (1 peça gerada de verdade, gastando crédito Gemini) é
o único item que falta pra fechar completamente o roteiro de aceite (critérios 7 e 12 na íntegra).
