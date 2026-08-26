# Vetor como agência completa — auditoria + prompt de reconstrução

**Gerado em:** 2026-08-26. Método: cruzamento de `docs/STATUS-REAL-ATUAL.md` (2026-08-19, evidência
real de produção/testes/SQL) + trabalho feito nesta sessão desde então (Rota Estratégica, Tráfego V2,
Missões Kanban, Creative Canvas in-node) + inspeção direta do código onde a data ficou desatualizada
+ pesquisa nas 4 referências anexadas pelo usuário. Nenhum item abaixo foi classificado sem evidência.

---

## Parte 1 — Auditoria: os 8 papéis pedidos vs. o que existe hoje

O pedido do usuário define o Vetor como agência com 8 frentes. Para cada uma: o que já está
**construído e provado**, o que está **construído mas não provado/incompleto**, e o que **não existe**.

### 1. Definir estratégia para a empresa
**Status: forte, com um gap real recém-descoberto.**
- ✅ Agente `estrategia` real (`apps/agentes/src/agents/prompts/estrategia.md`), dispara `propor_missao`
  com hipótese + critério de sucesso mensurável — provado ao vivo várias vezes nesta sessão.
- ✅ **Rota Estratégica** (commits `cfd492f`/`8c48270`, desta sessão): relatório executivo completo
  (diagnóstico + mercado + performance real + timeline dia-a-dia + checklist + métricas), confirmado
  renderizando em produção com dado real do Dog King Cambé.
- ⚠️ Gap real: **não há pesquisa de mercado/concorrência automatizada** — o diagnóstico de mercado na
  Rota Estratégica hoje vem do que o LLM já sabe + do que o cliente informa em chat, nunca de uma
  busca real na web. Não existe nenhuma tool de web search no Tool Registry (`apps/agentes/src/tools/registry.ts`).

### 2. Pesquisar sobre a empresa / mercado local / varredura de conteúdo-tráfego-mídias sociais já feitos
**Status: fraco — é o maior buraco real da lista.**
- ✅ Pesquisa *sobre a própria empresa*: existe via onboarding (`business_profiles`, brand kit,
  `business_context_snapshots`) — mas é o cliente que informa, o Vetor não sai buscando sozinho.
- ❌ **Não existe nenhuma ferramenta de pesquisa web real** (nem para mercado local, nem para
  varredura de concorrência, nem para auditar o que o próprio cliente já publicou nas redes antes do
  Vetor). O "Growth" mencionado no pedido do usuário mapeia pro agente `growth` já existente
  (`prompts/growth.md`), mas ele também não tem tool de pesquisa web — só raciocina sobre o que já
  está no contexto.
- **Isso é o gap #1 de prioridade real** — sem isso, "pesquisar mercado local" nunca vai ser verdade,
  só terminologia bonita no prompt.

### 3. Growth marketing
**Status: agente existe, pouco exercitado.**
- ✅ `agente: "growth"` é um dos 7 válidos em `AGENTES_EXECUTORES_VALIDOS` (`vetorPlataforma.ts`),
  tem prompt próprio.
- ⚠️ Nesta sessão inteira, quase nenhuma missão real passou por ele — a maior parte do trabalho ao
  vivo foi `estrategia`/`design`/`social-media`/`trafego`. Não é um bug, é falta de exercício real.

### 4. Design — gerar peças, imagens reais de produto, banco de imagens com prompts
**Status: a frente mais madura do sistema.**
- ✅ Design V1 completo e provado (Fabric.js, camadas editáveis, fontes de marca próprias,
  `DesignCritic` com 12 critérios + 5 estruturais — **provado nesta sessão rejeitando uma peça real
  por contraste/corte de texto**, comportamento correto, não fake pass).
- ✅ Design V2 (`ArtDirectionSpec`, 6 estilos de layout reais) — implementado depois do status de
  19/08 (estava `NOT_STARTED` naquele documento; hoje existe em `apps/agentes/src/negocio/artDirection.ts`).
- ✅ Seletor de provider por peça (Gemini "Nano Banana" / OpenAI GPT Image) já no Creative Canvas.
- ✅ Banco de imagens: `business_assets` existe de verdade (311 imagens reais no cliente de teste,
  categorizadas: ambientes_operacao/campanhas_referencias/identidade_visual/produtos_servicos).
- ❌ **Gap real, exatamente o que o usuário pediu**: "banco de imagens **com prompts** para a criação
  do mesmo" (funcionalidade do Gravyx) — hoje `business_assets` guarda o arquivo e metadados, mas
  **não guarda o prompt que gerou cada imagem gerada**, nem permite reusar/remixar um prompt salvo
  como ponto de partida pra uma peça nova. Isso é um campo + uma tela, não uma feature do zero.

### 5. Editor de vídeo — cortes, legendas, efeitos sonoros, edição por referência
**Status: fundação real, execução rasa — é o segundo maior gap.**
- ✅ Upload real, proxy real, timeline real com `trimIn`/`trimOut` reais, versionamento provado,
  análise de vídeo de referência via Claude vision **já provada em produção** (`ReferenceVideoProfile`).
- ⚠️ Migration `0024` já define **18 estágios** de pipeline profissional (captions, efeitos sonoros,
  color grading, etc. — o schema já prevê tudo isso). **Só 2 dos 18 rodam de verdade** (`proxy`,
  `timeline_draft`). Legendas têm schema e UI prontos (`CaptionsAndAudioPanel.tsx`) mas o stage
  `captions` **nunca executou** (0 linhas). Preview/render final: **nunca rodou** (0 de 5 projetos
  têm output).
- 🔍 Referência nova (Vendus Content Studio, ver Parte 2): "ChatCut" resolve exatamente isso — edição
  via comando de chat com IA fazendo corte/transcrição/revisão automaticamente, deixando o editor
  manual como avançado/opcional. É o padrão certo a seguir: **completar os estágios que já têm
  schema, expor como comando de chat**, não reinventar o pipeline.

### 6. Gestão de redes sociais — publicar conteúdo
**Status: planejamento existe, publicação real não.**
- ✅ Calendário editorial real (`CalendarioEditorial`), copy/legenda gerada pelo agente `social-media`
  provada nesta sessão ("Dobradinha da Semana", 3 variações de legenda reais).
- ❌ **Publicação automática real não existe** — Instagram aparece como "não conectado" em todo canto
  desta sessão; o fluxo OAuth existe (`/api/connections/instagram/start`) mas nunca foi exercitado de
  ponta a ponta. Isso é bloqueio de credencial (precisa do app Meta aprovado — mesmo bloqueio da
  Parte 2 do plano em andamento), não de código.

### 7. Gestão de tráfego
**Status: forte, acabou de ser reforçado nesta sessão.**
- ✅ Sync real via Meta Graph API (`metaAdsSync.ts`), funil de conversão real, leaderboard de
  criativos por métrica (top 5 por CPC/CTR/Compras), tudo commitado e testado nesta sessão.
- ❌ Único bloqueio: `connections`/`campanhas_trafego` com 0 linhas reais — precisa de app Meta
  aprovado + conta real conectada (Parte 2 do plano em andamento nesta sessão).

### 8. Dashboard de métricas e campanhas
**Status: fragmentado — existe dado, não existe um lugar único pra ver tudo.**
- ✅ `VetorCockpit.tsx` tem insights básicos (análise de voz, analytics simples, módulos ativos).
- ⚠️ Métricas reais de tráfego vivem em `/planejamento?aba=trafego`, métricas de design/social vivem
  espalhadas em `mission_steps`/`artifacts` sem uma visão agregada. Não existe um "Analítico" central
  — é exatamente o gap identificado na Fase 4.4 do plano já aprovado nesta sessão
  (`/Users/usuario1/.claude/plans/scalable-plotting-avalanche.md`).

### 9. Vetor — agente principal estilo Jarvis (fala e entende por áudio)
**Status: infraestrutura pronta, nunca provada ao vivo com voz real.**
- ✅ STT (`OPENAI` provider) e TTS (`fish`, fallback `onyx`) configurados com credenciais reais.
- ✅ UI do cockpit já simula a estética Jarvis (orbe central, "análise de voz", "resposta de
  frequência", "confiança") — mas com dados de placeholder ("Sem áudio no momento") porque nunca
  rodou de verdade.
- ❌ Wake word customizado ("Diga Vetor") **nunca funcionou** — faltam os 3 modelos ONNX treinados,
  não é código faltando, é artefato de ML que precisa ser gerado/comprado à parte.
- **Gap de prioridade média**: rodar 1 smoke test real de voz→texto→resposta→fala e persistir a
  prova, exatamente como `STATUS-REAL-ATUAL.md` já recomendava em 19/08 e ainda não foi feito.

---

## Parte 2 — O que aprendemos com as referências anexadas

### Gravyx (`app.gravyx.com.br`)
Já auditado exaustivamente em rodadas anteriores desta sessão (múltiplos documentos em `docs/`:
`GRAVYX-UPGRADE-AUDIT.md` etc.) — não repetido aqui. Os padrões estruturais relevantes (painel por
nó, seletor de IA por peça, funil/leaderboard de tráfego, Kanban de missões) já foram portados.

### Vendus Content Studio (curso "loja de saas", aula "Editando com Chatcut")
Achado concreto, direto de um frame real do vídeo da aula:
- **Estrutura de navegação**: hub central com orbe "V" glow (visualmente muito parecido com o núcleo
  do cockpit do Vetor hoje) cercado por 4 estados do fluxo (Bruto → Editor IA → Revisão → Instagram)
  em disposição radial.
- **Tagline do produto**: *"Você grava. O resto entra no fluxo."* — a transcrição, edição e revisão
  acontecem automaticamente; o editor manual (ChatCut) é só a opção avançada, não o caminho padrão.
  Isso valida a decisão da Parte 1, item 5: completar o pipeline automático antes de expor edição
  manual como o caminho principal.
- **Navegação lateral real do produto**: Visão geral, Conteúdos, Falar com o agente, Editor IA,
  Matriz de criativos, Agenda, Insights, Referências, ChatCut ao vivo — **note que "Falar com o
  agente" é uma tela própria, não misturado com o resto**, e "Editor IA"/"ChatCut ao vivo" são duas
  telas distintas (edição orientada por chat vs. editor visual ao vivo).
- **Fila automática com horários fixos de publicação** (ex: 08:00, 12:30, 18:30, 21:00) e um mini
  Kanban de produção (Entrada / Edição / Prontos) — padrão de UI direto para o Analítico/Social do
  Vetor (Fases 4.3/4.4 do plano em andamento).
- **Achado metodológico direto pro pedido de "prompt de reconstrução"**: a própria aula usa o padrão
  de **um único prompt de instalação** ("Quero que você instale e deixe funcionando o Vendus... O
  arquivo ZIP do sistema está anexado nesta conversa") entregue a um agente de codificação (Codex) —
  confirma que esse é um padrão real de mercado pra "handoff" de sistema, e é exatamente o formato da
  Parte 4 deste documento.

### YouTube — "Como EDITAR VÍDEOS com o CLAUDE CODE (Cortes + Motion)" (Rafa Voss | IA na Prática)
Confirma que existe demanda e prática real de mercado por usar Claude Code como motor de edição de
vídeo (cortes + motion graphics), reforçando a direção do item 5 da Parte 1. Não consegui extrair o
conteúdo passo a passo do vídeo (player não expôs transcrição/descrição via ferramenta de leitura) —
recomendo assistir manualmente antes de desenhar os prompts do stage `captions`/`efeitos`, já que o
próprio vídeo pode ter o "como" técnico (provavelmente FFmpeg orquestrado por Claude Code via Bash/MCP).

### Instagram @fabianocarvalhojr
Fundador da **lasy.ai** — app builder por linguagem natural em português, stack confirmada via
pesquisa: **Claude (Anthropic) + OpenAI + Gemini** simultaneamente, infra Supabase/Vercel/Cloudflare/
GitHub, "agente autocorretivo" que detecta e corrige erros durante a geração. Não encontrei um
repositório GitHub específico linkado na bio pública — o achado real e reaproveitável aqui é a
**confirmação de que multi-provider (não só um modelo) é o padrão de mercado** pra esse tipo de
produto, o que já é a arquitetura do Vetor (`ProviderRouter` existe, hoje só usado no TTS — ver
Parte 1, item 13 do `STATUS-REAL-ATUAL.md`: expandir o roteamento por custo/saúde pra design/vídeo
também é trabalho real, não greenfield).

### GitHub `msitarzewski/agency-agents`
Biblioteca de **200+ personas de agente** em 22+ divisões (Marketing sozinho tem 35+ sub-agentes:
Twitter, TikTok, Instagram, Reddit, SEO, email, podcast...). O padrão de arquivo de cada agente
(Identidade & Memória, Missão Central, Regras Críticas, Entregáveis Técnicos, Processo de Trabalho,
Métricas de Sucesso) é **mais rico** que os prompts atuais do Vetor em `apps/agentes/src/agents/prompts/*.md`
(que já são bons mas mais enxutos). **Reaproveitável de verdade**: usar essa estrutura de 6 seções
como checklist pra enriquecer os 7 prompts existentes do Vetor (nunca copiar texto — license do repo
não foi verificada, então é só referência de estrutura, igual ao padrão já usado em
`apps/agentes/src/skills/README.md` pra outras skills externas).

---

## Parte 3 — IAs/APIs recomendadas (além do que já está integrado)

O Vetor já integra: Claude (orquestração), Gemini "Nano Banana" + OpenAI GPT Image (design),
Higgsfield (vídeo), OpenAI (STT) + Fish/Onyx (TTS), Meta Graph API (tráfego). Recomendações novas,
cada uma com o porquê real:

| API/IA | Pra quê no Vetor | Por quê essa e não outra |
|---|---|---|
| **Nano Banana 2** (`gemini-3.1-flash-image`) | Upgrade do provider de imagem atual | $0.02/imagem, ~4s, consistência de sujeito em até 14 imagens de referência (resolve o item 4 — "imagens reais do produto" ficam consistentes entre peças), grounding com busca de imagem real no Google |
| **Tavily ou Exa** (API de busca) | Resolve o gap #1 da Parte 1 (pesquisa de empresa/mercado/concorrência) | APIs de busca desenhadas pra consumo por LLM (resultado já limpo, sem parsing de HTML), mais barato e previsível que abrir um browser real pra cada pesquisa |
| **ElevenLabs** | TTS mais natural pro "Vetor fala" (item 9) | Hoje é Fish/Onyx — ElevenLabs tem latência e naturalidade melhores pra um assistente de voz que o cliente vai ouvir com frequência; comparar custo real antes de trocar |
| **AssemblyAI ou Deepgram** | Transcrição real pro stage `captions` do Videomaker (item 5) | Transcrição com timestamps por palavra é o que falta pra popular `CaptionTrack`/`CaptionCue`, que já existe no schema mas nunca roda |
| **Runway Gen-4 / Kling 2** | Segunda opção de geração/edição de vídeo além do Higgsfield | Mesma lógica do `ProviderRouter` já usado pra design — nunca depender de um único provedor pago pra uma etapa crítica |
| **Claude Agent Skills** (via API, não CLI) | Empacotar os workflows que hoje são só prompt (ex: montar Rota Estratégica) como skill formal, redutível e testável | O Vetor **já tem seu próprio sistema de skills** (`apps/agentes/src/skills/`, 34 já importadas e ativas) — a ação aqui não é "adotar Skills", é **audit + enriquecer o que já existe**, ver Parte 5 |

---

## Parte 4 — Skills do Claude já em uso no Vetor (não é greenfield)

**Achado crítico pra não duplicar trabalho**: o Vetor já tem um sistema de skills próprio, real,
com proveniência de licença auditada, em `apps/agentes/src/skills/`:

- 34 skills importadas de repositórios MIT/Apache-2.0 reais (`coreyhaines31/marketingskills`,
  `samuraigpt/generative-media-skills`, `FireRedTeam/FireRed-OpenStoryline`, `KyaniteLabs/kinocut`,
  `irinabuht12-oss/google-meta-ads-ga4-mcp`, entre outros — lista completa em
  `apps/agentes/src/skills/README.md`), cobrindo marketing-psychology, ads, offers, growth-loops,
  A/B testing, diagnóstico, formato/adaptação, transcript-and-highlights, captions, brand-compliance,
  auditoria de conta (read-only), social-performance, quality-gate, análise de campanha, estratégia
  de conteúdo, brief criativo, influencer marketing, cross-platform report, pesquisa de cliente,
  plano de marketing, calendário de conteúdo, onboarding de marca, direção de imagem, recomendação
  de budget, attribution check, ingestão de mídia — **35 pastas reais em `skills/skills/`**.
- **Confirmado wired em produção**: `selecionarSkills`/`carregarSkillsSelecionadas` são chamados de
  dentro de `specialistRunner.ts` — não é inventário morto, os agentes especialistas realmente
  selecionam e carregam essas skills por trigger de texto da etapa.
- Carregamento progressivo real (manifest pequeno sempre carregado, `SKILL.md` completo só quando
  selecionada, `references/` só sob demanda) — arquitetura já correta, não precisa ser refeita.

**O que falta de verdade** (não é "adicionar skills", é fechar gaps do sistema existente):
1. Schema de manifest não tem `custo`/`timeout`/`idempotencyKey` (`STATUS-REAL-ATUAL.md`, item 14).
2. Nenhuma skill nova foi adicionada desde a importação inicial — os gaps da Parte 1 (pesquisa de
   mercado, captions de vídeo) são candidatos reais a skills novas, seguindo o mesmo processo de
   `apps/agentes/src/skills/README.md` (checar licença → adaptar vocabulário → manifest + SKILL.md +
   entrada em `source-manifest.json` → `permissions.ts` valida antes de ficar visível).
3. Nenhuma skill cobre hoje "pesquisa de mercado local" ou "edição de vídeo por comando de chat" —
   os dois maiores gaps da Parte 1 têm forma natural de virar skill nova em vez de código solto.

---

## Parte 5 — UI/UX: onde estamos vs. Spatial UI + Liquid Glass

### Onde estamos hoje (real, `apps/painel/src/app/globals.css`)
- Tema único escuro (`--color-petroleo: #050a12`, superfícies em `oklch`), tipografia Inter + JetBrains
  Mono (Inter é a fonte "genérica demais" mais citada em auditorias de design de IA — candidata a troca).
- `@utility panel`: `backdrop-filter: blur(10px)` + gradiente sutil + borda com `color-mix` — é
  glassmorphism **básico** (só blur), sem refração nem realce de borda animado.
- `@utility vetor-aurora`: `conic-gradient` com blur 60px animado — decorativo, não tem profundidade
  real (não há z-stacking, não há sombra projetada, tudo é 2D plano).
- Nenhum uso de `perspective`/`transform: rotateX/rotateY/translateZ`, nenhum parallax por mouse,
  nenhuma sombra que varia com "altura" simulada — ou seja, **zero Spatial UI hoje**, mesmo com a
  linguagem visual já "tech/dark" estar no caminho certo.

### Como chegar em Liquid Glass (refração + brilho de borda) — 100% CSS, sem WebGL
- **Refração real** exige um filtro que distorça o que está atrás do vidro — CSS puro não tem
  refração verdadeira, mas o efeito é simulável de forma convincente com: `backdrop-filter: blur(Npx)
  saturate(150%)` (já usado) + um pseudo-elemento `::before` com `mix-blend-mode: overlay` e um
  gradiente radial sutil que se desloca com a posição do mouse (dá a sensação de "luz passando pelo
  vidro").
- **Brilho de borda que "corre na quina"**: `border-image` animado ou um `::after` com
  `background: conic-gradient(...)` girando (`animation: spin`) recortado só na borda via `mask`
  (`mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0); mask-composite: xor`) —
  técnica real e leve, sem dependência nova.
- Isso é evolução direta da `@utility panel` que já existe, não uma reescrita.

### Como chegar em Spatial UI (profundidade real, janelas flutuando)
- **Empilhamento com profundidade real**: cada painel/nó ganha `transform: perspective(1200px)
  rotateY(Ndeg) translateZ(Mpx)` variável por z-index, sombra (`box-shadow`) escalando com o `translateZ`
  (quanto "mais perto" da câmera, sombra maior/mais difusa) — dá o efeito Vision Pro sem WebGL.
- **Parallax sutil por mouse**: listener de `mousemove` no container, aplica `rotateX/rotateY`
  pequenos (±2-4deg) proporcional à posição do cursor — já existe padrão parecido implícito no
  `card-lift` (hover levanta com `translateY`), é extensão natural, não conceito novo pro código.
- **Onde aplicar primeiro**: o Creative Canvas (React Flow, já tem nós que se sobrepõem e têm
  z-index) é o candidato natural pra Spatial UI de verdade — já tem a estrutura de "várias janelas no
  mesmo espaço", só falta a profundidade visual real.
- **Custo de performance**: `transform`/`filter` bem aplicados (sem redesenhar layout) são baratos;
  a regra `@media (prefers-reduced-motion: reduce)` já existe em `globals.css` e deve cobrir tudo
  isso também.

---

## Parte 6 — Prompt de reconstrução (para rodar como diretiva de execução)

> Este bloco é o "prompt de execução" pedido. Ele assume o Vetor **existente neste repositório** como
> base — nunca greenfield, sempre reforço do que já está construído e provado (Partes 1 e 4). Deve
> ser executado em fases sequenciais e verificadas, não em paralelo (lição já aprendida nesta sessão:
> um push em `apps/agentes` no meio de um teste ao vivo derrubou o worker de missões em produção).

```
Você está reconstruindo o VETOR, uma agência de marketing autônoma operada por IA, dentro do
repositório já existente (não criar um projeto novo). Antes de escrever qualquer código, leia
docs/AUDITORIA-E-PROMPT-RECONSTRUCAO-2026-08.md (auditoria completa e atualizada) e
docs/STATUS-REAL-ATUAL.md (estado real por evidência) — nunca assuma que uma feature não existe sem
checar essas fontes E o código primeiro.

MISSÃO
O Vetor tem 8 frentes: Estratégia, Pesquisa (empresa/mercado/concorrência/varredura de redes),
Growth, Design (peças + banco de imagens com prompt reutilizável), Editor de vídeo (cortes,
legendas, efeitos sonoros, edição por referência), Gestão de redes sociais (agendamento e
publicação real), Gestão de tráfego, Dashboard de métricas — coordenadas pelo agente Vetor
(estilo Jarvis, capaz de voz real). Reforce cada frente na ordem de prioridade real (não a ordem
em que foram pedidas): gaps que bloqueiam tudo o resto vêm primeiro.

ORDEM DE EXECUÇÃO (cada fase termina com verificação ao vivo antes da próxma; nunca fazer duas
fases que tocam apps/agentes ao mesmo tempo — sempre checar se há missão de teste em andamento
antes de dar push)

FASE A — Pesquisa real (fecha o maior gap, Parte 1 item 2)
- Adicionar 1 tool nova ao Tool Registry (apps/agentes/src/tools/registry.ts) que chama uma API de
  busca (Tavily ou Exa — comparar preço/qualidade antes de decidir) com risco baixo (read-only).
- Nova skill em apps/agentes/src/skills/skills/market-research/ seguindo o processo real do
  README.md do skill registry (licença → adaptação → manifest → source-manifest.json →
  permissions.ts) para orientar o agente growth/estrategia a usar essa tool na pesquisa de mercado
  local e varredura de concorrência.
- Verificação: pedir ao Vetor, no chat, uma Rota Estratégica de um cliente real e confirmar que a
  seção "Mercado e concorrência" passa a citar fonte real (não mais só o que o LLM já sabia).

FASE B — Banco de imagens com prompt reutilizável (Parte 1 item 4, funcionalidade Gravyx)
- Migration aditiva em business_assets (ou tabela nova business_asset_prompts) guardando o prompt
  real usado em cada imagem gerada, vinculado ao asset.
- Tela no Design (workspace já existente) pra listar/reusar/remixar prompts salvos.
- Verificação: gerar 1 peça nova reaproveitando um prompt salvo de uma peça anterior, confirmar que
  o resultado é visivelmente derivado do mesmo prompt base.

FASE C — Editor de vídeo: completar os estágios que já têm schema (Parte 1 item 5)
- Rodar o stage "captions" de verdade (schema e UI já prontos) usando um provider de transcrição
  real (AssemblyAI/Deepgram — Parte 3) — popular CaptionTrack/CaptionCue com timestamp real.
- Rodar o stage de preview/render final até pelo menos 1 vídeo real ter output_storage_path
  populado (hoje 0 de 5 projetos têm).
- Nova skill/comando de chat "editar esse vídeo: corta os silêncios, adiciona legenda, usa o efeito
  X" no espírito do ChatCut (Parte 2) — o editor manual continua existindo, vira o modo avançado, não
  o caminho padrão.
- Verificação: 1 vídeo real passando por upload → proxy → timeline → captions → render final, com
  prova em SQL de cada estágio populado.

FASE D — Dashboard Analítico central (Parte 1 item 8, já é a Fase 4.4 do plano em andamento)
- Consolidar métricas de tráfego + design + social num workspace único /analitico.
- Popular custo_estimado_centavos em agent_runs (hoje sempre NULL) — barato, fecha observabilidade.

FASE E — Voz real (Parte 1 item 9)
- 1 smoke test real de voz→texto→resposta→fala em produção, log persistido como prova.
- Wake word customizado fica registrado como bloqueado por artefato de ML (não código) até decisão
  separada sobre treinar/comprar os modelos ONNX.

FASE F — UI/UX Liquid Glass + Spatial (Parte 5)
- Evoluir @utility panel (globals.css) com a técnica de borda animada (Parte 5) — aplicar primeiro
  num componente isolado, confirmar visualmente nos dois temas antes de espalhar.
- Aplicar profundidade real (perspective/translateZ/parallax) primeiro no Creative Canvas (já tem
  nós sobrepostos, candidato natural), medir performance antes de expandir pro resto do painel.
- Trocar Inter por uma fonte self-hosted com mais caráter (ex: pacote geist, OFL, já decidido na
  Fase 4.5 do plano em andamento nesta sessão) — não decidir uma fonte nova sem essa etapa.

FASE G — Skills: fechar os gaps do sistema já existente (Parte 4)
- Adicionar custo/timeout/idempotencyKey ao schema de manifest de skill.
- As skills novas das Fases A e C já contam como a expansão real pedida — não adicionar skill por
  adicionar, só onde fecha um gap reconhecido nesta auditoria.

REGRAS QUE NÃO MUDAM (já em vigor no projeto, reafirmadas aqui)
- Nunca copiar marca/paleta/logo de nenhuma referência externa (Gravyx, Vendus, etc.) — só
  estrutura/interação, sempre nos tokens de design do próprio Vetor.
- Nunca fabricar dado/métrica — estado vazio ou "não conectado" é sempre preferível a um número
  inventado (DesignCritic e a Rota Estratégica já seguem essa regra, mantê-la em tudo que for novo).
- Nunca instalar o catálogo de skill externo inteiro — só a skill específica que fecha um gap real,
  com licença checada, pelo processo já documentado em apps/agentes/src/skills/README.md.
- git status/diff antes de todo commit; nunca dar push em apps/agentes com uma missão de teste em
  andamento; testes + build locais antes de cada push; verificação ao vivo antes da fase seguinte.
```

---

## O que este documento NÃO é

Este documento é a auditoria + o prompt de execução pedidos — **não é autorização para eu começar a
implementar as 7 fases (A–G) imediatamente**. Dado o histórico desta sessão (execução paralela sem
checkpoint já causou um incidente real hoje), a recomendação é: revisar este documento, decidir a
ordem/prioridade real entre as fases A–G (ou confirmar a ordem sugerida), e então eu começo pela
Fase A isoladamente, com verificação ao vivo antes de qualquer fase seguinte.
