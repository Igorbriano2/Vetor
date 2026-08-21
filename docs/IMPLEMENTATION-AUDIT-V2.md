# Auditoria de implementação — VETOR Manager V2 (Fase 0)

**Gerado em:** 2026-08-21. Só leitura — nenhum código foi alterado pra produzir este documento.
**Método:** 3 subagentes read-only (Explore) rodando em paralelo, cada um cobrindo uma área
(cockpit/upload/canvas; planejamento/tráfego; schema do banco), com citação de arquivo:linha pra
cada afirmação. Complementado por verificação direta minha em 2 pontos (barra de status/topo,
estados já suportados pelo `VetorCore`). Nenhuma suposição de nome de arquivo — todos os caminhos
abaixo foram confirmados existirem de verdade no repositório.

```text
FASE: 0
OBJETIVO: Descobrir o estado real do código, schema e contratos antes de qualquer alteração.
SKILLS SELECIONADAS: Explore (subagent, x3, paralelo)
POR QUE ESTAS SKILLS: Fase de descoberta pura, read-only — não há skill de arquitetura/segurança/
  banco instalada neste ambiente (ver docs/CLAUDE-CODE-SKILLS-INVENTORY.md); Explore é a ferramenta
  correta pra levantamento rápido e preciso de arquivos/contratos sem risco de escrita.
SKILLS NÃO USADAS: security-review (não há mudança de código pra revisar ainda), artifact-design/
  artifact-diagramming (nenhum Artifact publicado nesta fase — o relatório é só markdown).
ARQUIVOS PREVISTOS: nenhum (fase de leitura). Saída: docs/IMPLEMENTATION-AUDIT-V2.md,
  docs/CLAUDE-CODE-SKILLS-INVENTORY.md.
CRITÉRIO DE ACEITE: relatório com caminho real confirmado para cada item pedido no prompt, gaps
  reais identificados, nenhuma linha de código de produto alterada.
```

---

## 1. Sumário executivo

O pedido descreve um redesign ambicioso da tela inicial, upload no chat, um canvas node-based novo,
um calendário editorial e um dashboard de tráfego. A auditoria confirma:

- **A tela inicial já tem um núcleo (`VetorCore`) real, funcional e com quase todos os estados
  pedidos** — não precisa ser reescrita do zero, precisa ser **elevada** (tamanho, composição,
  fullscreen, painéis de telemetria ao redor). Isso é uma boa notícia de escopo.
- **Upload no chat não existe de jeito nenhum hoje** — o componente ativo (`VetorCockpit.tsx`) não
  tem input de arquivo; existe um componente morto (`VetorCommandBar.tsx`, não importado em lugar
  nenhum) com um comentário explícito dizendo que anexos foram propositalmente adiados. `/api/comando`
  só aceita `texto`/`conversationId` — sem `assetIds`. Isto é trabalho genuinamente novo (Fase 2).
- **Canvas node-based não existe em absolutamente nada** — zero dependência de biblioteca de grafos
  (`reactflow`/`xyflow`/`konva`) no `package.json`. O que existe com nome parecido
  (`MissionCanvas.tsx`) é só uma visualização SVG **read-only** do grafo de uma missão, não um editor.
  Trabalho 100% novo (Fase 3).
- **Planejamento hoje é uma lista de cards de documentos**, não um calendário mensal navegável. O
  "calendário" é JSON livre dentro de `artifacts.metadata` — sem tabela dedicada, sem schema
  validado, sem navegação mês/semana, sem drawer de detalhe, sem botão "Montar planejamento do mês".
  Trabalho substancial de UI (Fase 5) — decisão de schema a confirmar (seção 7).
- **Tráfego já é um dashboard real (não placeholder)**, mas com duas lacunas específicas: (a) sem
  conexão Meta, mostra estado vazio — não existe hoje nenhum conceito de dado **DEMO** rotulado; (b)
  "Análise do Gestor" não existe como painel visual — o que existe é um `diagnostico` sempre gerado
  por um **template hardcoded** (nunca IA) e três colunas jsonb (`oportunidades`, `riscos`,
  `recomendacoes`) que **nunca são preenchidas por ninguém** em todo o código. Existe sim uma análise
  real por IA, mas só via chat (skill `campaign-analysis`), não num painel.

Nenhum gap encontrado exige reescrever backend, RLS, Mission Orchestrator ou Design V1 — confirma que
o pedido "alterações incrementais, sempre reutilizando os contratos existentes" é viável como
descrito.

---

## 2. Tela inicial — estado real vs. pedido

| Arquivo real | O que já existe | Gap vs. o pedido |
|---|---|---|
| `apps/painel/src/app/(painel)/vetor/page.tsx` | Server component, resolve `clienteId`, busca `missions`/`approvals`/`demandas` pendentes, `criacoesRecentes` (4 últimas), passa tudo pro `VetorCockpit` (page.tsx:17-78) | Nenhum — só orquestra dados, não precisa mudar de forma. `saudacaoJaTocada` está hardcoded `false` (page.tsx:73-77, comentário próprio já assume) — bug pré-existente, não deste escopo, mas vale registrar. |
| `apps/painel/src/components/VetorCockpit.tsx` | Coluna única centralizada `max-w-3xl` (VetorCockpit.tsx:384) — **não é fullscreen**. Núcleo `VetorCore` já presente no topo (`w-56 sm:w-64`, linha 393), ações rápidas em pills (linhas 405-425, 6 itens já batem com a lista pedida: Criar peça/vídeo/planejar/analisar/referência), chat card com balões + input + mic emoji + `VoiceIndicator` (linhas 427-509), "Criações recentes" (512-524), tira de status em mono no rodapé (527-539) | Falta: layout fullscreen com fundo `#020711`; núcleo dominante (260-340px); 4 painéis de telemetria à esquerda e 4 à direita; barra fina de topo com "SISTEMA ONLINE"/"VOICE LINK"/relógio; barra fina de rodapé com cidade/horário/navegação/sync. Nada disso existe hoje. |
| `apps/painel/src/components/VetorCore.tsx` | **Já suporta 11 estados** (`EstadoCore`, linhas 1-12): `idle, welcoming, listening, transcribing, understanding, planning, speaking, executing, approval, success, error` — cobre 7 de 7 estados pedidos (`idle→idle`, `listening→listening`, `understanding→understanding`, `planning→planning`, `executing→executing`, `speaking→speaking`, `approval→"AGUARDANDO APROVAÇÃO"`, `error→error`). Renderiza um SVG orbital real (anéis, partículas, pulsação por amplitude, gradiente radial — linhas 91-176), portado da landing page pra manter identidade visual (comentário linhas 56-59) | **Não precisa reescrever a state machine.** Só elevar composição/brilho/tamanho/responsividade — exatamente o que o pedido pede ("Reutilizar o VetorCore existente quando possível, mas elevar a composição"). |
| `apps/painel/src/components/shell/SidebarNav.tsx` | Já reduzido a 4 áreas (`GRUPOS_NAV`, linhas 17-27): VETOR/Criações/Planejamento/Negócio, com sub-rotas mapeadas pra manter destaque ativo sem aparecer no menu (linhas 32-35) | Já conforme o pedido ("As quatro áreas visíveis continuam sendo..."). Só precisa virar drawer recolhido em vez de `<aside>` fixo (linha 106) se a nova tela inicial não tiver espaço pra sidebar fixa — decisão de Fase 1. |
| Barra de topo (SISTEMA ONLINE / VOICE LINK / relógio) | **NÃO ENCONTRADA** (confirmado por grep direto, zero ocorrências) | 100% novo. |
| Painéis de telemetria (Análise de Voz, Resposta de Frequência, Confiança, Status do Sistema, Insights, Analytics, Módulos Ativos, Conexão) | **NENHUM existe** | 100% novo — e cada um precisa de uma fonte de dado real ou honestamente "aguardando"/contextual (nunca inventar percentual), conforme o próprio pedido exige. |

**Dados reais disponíveis pra alimentar os painéis sem inventar nada** (mapeamento pra Fase 1):
- `STATUS DO SISTEMA`: pode refletir `missaoAtual`/`contagemPendentes`/`contagemAtivas` já buscados em `vetor/page.tsx`.
- `CONTEXTO ATIVO` (alternativa honesta a CPU/RAM/DISK que o próprio pedido permite): workspace ativo, BrandKit (`business_assets` com `is_logo_principal`), referências (`reference_library_items`), conexões (`connections`).
- `CONEXÃO`: tabela `connections` já existe e já é usada em `planejamento/page.tsx:58-63` pra checar Meta Ads — mesmo padrão serve pra Supabase/WhatsApp.
- `CONFIANÇA`: não há campo de confiança de intenção persistido hoje em `mensagens_plataforma`/`solicitacoes` além de `confianca_transcricao` (transcrição de voz, não intenção) — precisa decisão explícita na Fase 1 sobre mostrar "aguardando" honestamente até existir esse dado, conforme o próprio pedido já prevê.

---

## 3. Upload no chat — estado real vs. pedido

- **Chat ativo (`VetorCockpit.tsx`) não tem nenhum mecanismo de anexo** — confirmado por grep
  (zero ocorrências de upload/anexo/attachment/assetIds no arquivo). Input row é só texto + mic
  (linhas 474-492).
- Existe um componente **morto**, `apps/painel/src/components/VetorCommandBar.tsx`, não importado
  em lugar nenhum do app, com o comentário explícito: `// Anexos ficam fora desta rodada — precisam
  de storage S3, não provisionado.` (linha 46) — confirma que isto já foi cogitado antes e
  deliberadamente adiado.
- `apps/painel/src/app/api/comando/route.ts`: aceita hoje só `{ texto, conversationId }` no corpo
  (linhas 24-26), sem qualquer campo de anexo. Encaminha pra `apps/agentes` como
  `{ cliente_id, texto, responder_em_voz, conversation_id, usuario_id }` (linhas 46-52) — **nenhum
  campo pra `assetIds` existe no contrato hoje, em nenhuma ponta**.
- Fluxo de upload que **já existe e funciona** (reaproveitável): `business_assets`
  (`supabase/migrations/0016_business_assets_uploads_trafego.sql` + extensão
  `0018_business_assets_drive.sql`) — usado hoje por `ReferenciasPainel.tsx`,
  `VideomakerUpload.tsx`, `BancoDeImagensPainel.tsx`. Upload é **imediato** (sem staging
  "rascunho→aprovado" obrigatório — o valor default de `status` é `'aprovado'`, comentário na
  migration 0018 linhas 40-44 confirma isso é intencional). Bucket usado: `brand-assets` (via
  `apps/agentes/src/negocio/businessAssets.ts`).
- **Não existe hoje nenhum endpoint de upload dedicado no painel** (`apps/painel/src/app/api`) —
  todo upload existente passa direto pelo client Supabase (`storage.from(...).upload(...)`) nos
  próprios componentes React, sem uma rota `/api/upload` intermediária.

**Implicação pra Fase 2**: o pedido descreve um "asset temporário antes do envio" com validação de
MIME/tamanho/RLS server-side — isso não existe hoje (uploads atuais são direto client→Storage,
sem um endpoint server-side de validação). Construir esse endpoint novo é trabalho real da Fase 2,
mas pode reaproveitar o bucket/tabela `business_assets` já existente como destino final, evitando
criar um segundo sistema de storage paralelo.

---

## 4. Creative Canvas node-based — estado real vs. pedido

- **Não existe absolutamente nada equivalente.** `apps/painel/package.json` não tem `reactflow`,
  `xyflow`, `konva` ou qualquer lib de grafo — só `"fabric": "^7.4.0"` (design canvas, não node-graph).
- `apps/painel/src/components/MissionCanvas.tsx` tem nome parecido mas é **outra coisa**: uma
  visualização **read-only** em SVG do DAG de uma missão (`mission_steps` + `depende_de`), com
  comentário explícito "Nunca editável aqui" (linhas 15-19 conforme já documentado em rodadas
  anteriores desta sessão).
- `apps/painel/src/components/design/DesignCanvasEditor.tsx` é o editor de camadas Fabric.js
  (Scene Graph real, já confirmado nesta sessão com logo travada e textbox editável) — é o motor de
  renderização final que o canvas de nodes deve **reutilizar no node "Scene Graph"/"Resultado"**,
  não algo a substituir.

**Implicação pra Fase 3**: é a fase de maior risco técnico do pedido inteiro — requer escolher e
instalar uma biblioteca de grafo nova (nenhuma está pré-aprovada/instalada), desenhar o schema de
persistência do grafo (provavelmente um novo campo jsonb num novo tipo de projeto, análogo a
`design_projects.canvas_json`), e integrar com o Scene Graph/Fabric.js existente só no node final —
nunca substituindo-o.

---

## 5. Planejamento — estado real vs. pedido

- `apps/painel/src/app/(painel)/planejamento/page.tsx` (238 linhas): renderiza uma lista de cards de
  **documentos de plano** (`artifacts` onde `type = "plan"`) + um grid de "day-cards" extraído de
  `artifacts.metadata.calendario` (array JSON livre, sem schema validado) — **não é um calendário
  mensal navegável**. Confirmado: sem navegação mês/semana, sem seletor de view, sem filtro por
  canal/status, sem drawer de detalhe ao clicar num item (só links pra `/missoes/{id}`), sem botão
  "Montar planejamento do mês" (existe só uma dica de texto: "peça pelo chat: 'monte o planejamento
  de agosto'", linha 74).
- **Não existe tabela de calendário editorial dedicada.** O "calendário" vive inteiramente dentro de
  `artifacts.metadata` (jsonb), populado por qualquer agente que gerou aquele documento — sem
  validação de schema, sem colunas próprias pra status/canal/data de forma consultável via SQL.
- Segunda seção da página, "Hipóteses em jogo" (linhas 201-232), lê `missions.hipotese` —
  independente do calendário, não precisa mudar.

**Implicação pra Fase 5, decisão a confirmar antes de codificar** (ver seção 7): o pedido descreve
um item de calendário com 13 campos estruturados (título, data, canal, formato, objetivo, editoria,
persona, briefing, copy, asset, referência, status, datas de entrega/aprovação, missão,
agendamento) e múltiplos status — isso é naturalmente relacional, não mais um blob jsonb solto.
Continuar usando `artifacts.metadata` forçaria filtros/status/drawer a operarem sobre JSON não
indexado; a alternativa (nova tabela `calendario_editorial` ou similar) é uma migration nova, que o
pedido permite desde que eu liste "motivo, tabela e rollback" antes de criar.

---

## 6. Dashboard de Tráfego/Social — estado real vs. pedido

- Rota `/trafego` é **só um redirect** pra `/planejamento?aba=trafego`
  (`apps/painel/src/app/(painel)/trafego/page.tsx:1-8`). Implementação real:
  `apps/painel/src/app/(painel)/trafego/TrafegoPainel.tsx` (174 linhas, client component).
- **Já é um dashboard real, não placeholder**: lista campanhas de `campanhas_trafego` com status,
  orçamento (convertido de centavos) e métricas (`spend`, `impressions`, `clicks`, `ctr`) lidas de
  `metricas` jsonb (linhas 118-143), mostra o último `diagnostico` e timestamp de sync (linhas
  96-114), botão "Sincronizar agora" que chama `POST /api/trafego/sincronizar` (linhas 50-67).
- 3 abas internas: `dashboard` (a real, acima), `gestor` (linhas 147-159 — **é só texto estático**
  dizendo pra falar com o chat, sem nenhum gráfico/KPI/hipótese), `conexoes` (texto apontando pra
  `/conexoes`).
- **Sem conexão Meta, mostra vazio — não existe conceito de dado DEMO** (grep por "DEMO" no
  diretório inteiro: zero ocorrências). O código tem um princípio já estabelecido e explícito
  (`apps/agentes/src/connections/metaAdsSync.ts:5-8`: "Nunca inventa dado") — o pedido de dataset
  DEMO precisa ser reconciliado com isso: **dado demo rotulado como DEMO não viola esse princípio**
  (o princípio é sobre nunca fingir que um dado é real; DEMO explicitamente identificado é honesto),
  mas é uma tensão que registro aqui pra ficar claro que não é uma contradição, e que todo dado DEMO
  precisa de um rótulo visual inequívoco em cada componente que o exibe.
- **"Análise do Gestor" não existe como painel visual.** O que existe:
  - `sincronizarTrafego()` (`apps/agentes/src/connections/metaAdsSync.ts:166-182`) grava em
    `trafego_analises.diagnostico` um **template hardcoded** (`"N campanha(s) sincronizada(s), gasto
    total últimos 30 dias: R$ X"`) — nunca gerado por IA.
  - As colunas `oportunidades`, `riscos`, `recomendacoes` (jsonb, já existem no schema desde a
    migration 0016) **nunca são escritas por nenhum código** — sempre `[]`. Confirmado por grep, sem
    nenhum outro writer.
  - Existe uma análise real por IA, mas só via chat: skill `campaign-analysis`
    (`apps/agentes/src/skills/skills/campaign-analysis/manifest.json`, department `traffic`,
    `riskLevel: low`), disparada por frases como "como está performando essa campanha" — nunca
    renderizada num painel.
  - `GET /trafego/analises` (`apps/agentes/src/routes/trafego.ts:32-51`) já expõe a última análise,
    mas **nenhuma UI do painel chama esse endpoint hoje** — `TrafegoPainel.tsx` só recebe
    `analiseInicial` via props do server component.

**Implicação pra Fase 6**: as colunas `oportunidades`/`riscos`/`recomendacoes` já existem — não
precisa de migration nova pra guardar a análise do Gestor, só popular esses campos de verdade (via
IA, análogo ao que a skill `campaign-analysis` já faz) e construir o painel visual que hoje não
existe (a aba "gestor" é só texto).

---

## 7. Schema confirmado (tabelas relevantes, colunas reais)

| Tabela | Migration | Colunas-chave confirmadas |
|---|---|---|
| `artifacts` | `0015_artifacts.sql:6-38` | `type` enum (image/video/copy/document/report/plan/campaign_snapshot), `status` enum, `metadata jsonb`, `version`. RLS: só `select` pro cliente — escrita é `service_role` only. |
| `missions` / `mission_steps` | `0004_missions.sql:6-41` | `missions.status` (12 valores enum), `mission_steps.risco` (low/medium/high), `mission_steps.status` (9 valores), `depende_de uuid[]`, `resultado jsonb`. |
| `agent_runs`, `approvals` | `0004_missions.sql:43-73` | `approvals.risco` (medium/high), `approvals.status` (6 valores). `approvals` sem policy de insert pro cliente — só backend cria, cliente só decide. |
| `conversas` / `solicitacoes` / `mensagens_plataforma` | `0009_conversas_solicitacoes.sql:9-52` (+ `0020` estende `origem`) | Cada tabela tem `cliente_id` próprio (não derivado). `mensagens_plataforma` é **só texto** (`texto`, `transcricao`) — nenhuma coluna de anexo/artifact_id/asset_id hoje. |
| `business_assets` (+`business_asset_folders`+`business_asset_usage`) | `0016_business_assets_uploads_trafego.sql:12-24` + `0018_business_assets_drive.sql:46-64` | `status` default `'aprovado'` (upload imediato, sem staging obrigatório), `tipo_ativo`, `categoria`, `is_logo_principal`, `favorito`. |
| Calendário editorial mensal | **não existe tabela dedicada** | Vive como JSON livre em `artifacts.metadata.calendario` — ver seção 5. |
| `campanhas_trafego` | `0001_init.sql:60-72` (+ unique index `0017`) | `status` sem check constraint (texto livre), `metricas jsonb`. |
| `trafego_analises` | `0016_business_assets_uploads_trafego.sql:63-73` | `diagnostico text`, `oportunidades/riscos/recomendacoes jsonb` (sempre vazios hoje — ver seção 6). Insert-only (sem upsert). |
| `design_projects` | `0021_design_projects.sql:11-41` | `canvas_json jsonb`, `status` (draft/awaiting_approval/approved/archived) — Scene Graph real, intocado por este trabalho. |
| `design_flows` | `0031_design_flows.sql` + `0033_design_flows_receita.sql` | `receita jsonb` livre — mesmo padrão de "schema-less deliberado" que pode servir de referência pra decisão do calendário (seção 5). |

**Padrão de RLS, 100% consistente em toda tabela acima**:
```sql
cliente_id = current_cliente_id() or current_papel() = 'admin_vetor'
```
Nenhuma tabela foge desse padrão. Qualquer tabela nova (ex: calendário editorial, se a decisão for
criar uma) deve seguir exatamente essa policy.

---

## 8. Endpoint de upload — busca por endpoint dedicado

Nenhum endpoint de upload dedicado existe em `apps/painel/src/app/api`. Toda escrita em Storage hoje
acontece direto do client React pro Supabase Storage (`supabase.storage.from(...).upload(...)`),
sem uma rota server-side intermediária de validação. O backend (`apps/agentes`) tem várias funções
de upload/storage já existentes (`businessAssets.ts`, `artifactsService.ts`, `videoProjects.ts`,
`referenceLibrary.ts`) — todas dentro dos fluxos já conhecidos de Drive/artifacts/referências, sem
nenhum upload "escondido" fora desses três sistemas.

---

## 9. Contratos a preservar (não tocar sem necessidade comprovada)

- `POST /api/comando` — contrato atual `{ texto, conversationId, responder_em_voz? }`. Adicionar
  `assetIds?` (Fase 2) é uma extensão aditiva — clientes antigos que não mandam esse campo continuam
  funcionando (mesmo padrão já usado nesta sessão pra `provider`/`estilo_visual` em
  `criar_peca_de_design`).
- RLS pattern único (`cliente_id = current_cliente_id() or current_papel() = 'admin_vetor'`) —
  qualquer tabela nova segue o mesmo padrão, sem exceção.
- `business_assets` como sistema de storage de Drive — não duplicar com um segundo bucket/tabela
  pra anexos de chat; reaproveitar.
- `design_projects.canvas_json` (Scene Graph Fabric.js) — o Creative Canvas (Fase 3) consome isso no
  node final, nunca substitui.
- `VetorCore.tsx` `EstadoCore` — já cobre os 7 estados pedidos; a Fase 1 estende a composição visual,
  não a máquina de estados.
- Mission Orchestrator, Policy Engine, ProviderRouter — nenhum gap encontrado nesta auditoria exige
  tocar neles.

---

## 10. Decisões a confirmar antes de codificar (não decidi sozinho, listo as opções)

1. **Calendário editorial (Fase 5)**: continuar em `artifacts.metadata.calendario` (jsonb, zero
   migration, mas sem filtro/índice real por status/canal/data) vs. nova tabela relacional dedicada
   (migration nova, RLS no padrão já confirmado, mas schema fixo). Minha recomendação, se pedida: os
   13 campos estruturados do pedido + status/filtros indicam tabela dedicada — mas é uma migration
   nova, então listo aqui em vez de decidir sozinho, conforme a regra do prompt.
2. **Anexos de chat (Fase 2)**: reaproveitar `business_assets` (bucket `brand-assets`) marcando
   origem como "chat" via uma tag/categoria existente, vs. criar um bucket/tabela novo dedicado a
   anexos efêmeros de conversa. Recomendo reaproveitar (menos superfície nova), mas listo como
   decisão porque `business_assets` hoje não distingue "anexo temporário de conversa" de "ativo
   permanente do Drive" — precisaria de um campo novo (`origem_chat boolean` ou similar).
3. **Dataset DEMO de tráfego (Fase 6)**: gerar demo a partir de valores fixos documentados no código
   (nunca vindo do banco) vs. seed real em `campanhas_trafego`/`trafego_analises` marcado com uma
   flag `is_demo`. Recomendo a primeira opção (dados fixos no código, nunca no banco) — mais simples,
   impossível de vazar como "real" por engano, e não exige migration.
4. **Biblioteca de canvas node-based (Fase 3)**: nenhuma está instalada hoje; escolha entre
   `@xyflow/react` (React Flow, mais madura/documentada) ou alternativa. Fica pra você decidir ou eu
   escolher com justificativa na Fase 3, já que o pedido não nomeia uma biblioteca específica.

---

## 11. O que NÃO fazer nesta fase (lembrete das restrições do próprio pedido)

Nenhum código foi alterado. Nenhuma migration foi criada. Nenhuma skill de marketplace foi instalada.
Nenhuma decisão de produto das listadas na seção 10 foi tomada unilateralmente — ficam explícitas
aguardando confirmação, conforme a regra "Não pedir ao usuário decisões de produto que já foram
definidas neste prompt" (as da seção 10 não estão definidas no prompt — são decisões técnicas de
schema/biblioteca que o prompt genuinamente deixou em aberto).

```text
FASE CONCLUÍDA: 0
SKILLS EXECUTADAS: Explore x3 (paralelo) — todos concluídos com sucesso, achados citados por arquivo:linha nas seções 2-8 acima.
ARQUIVOS ALTERADOS: nenhum arquivo de código. Criados: docs/IMPLEMENTATION-AUDIT-V2.md, docs/CLAUDE-CODE-SKILLS-INVENTORY.md.
MIGRATIONS: nenhuma.
TESTES: não aplicável (nenhum código alterado).
EVIDÊNCIAS: citações arquivo:linha em cada seção acima; 3 relatórios brutos dos subagentes Explore (não commitados — são investigação, não produto).
FALHAS/BLOCKED: nenhuma.
ROLLBACK: não aplicável — nenhuma mudança de código nesta fase.
PRÓXIMA FASE: 1 (redesign da tela inicial) — só após sua confirmação explícita, incluindo as 4 decisões da seção 10 que impactam fases futuras (a decisão #4, biblioteca de canvas, só afeta a Fase 3, pode ser confirmada depois).
```
