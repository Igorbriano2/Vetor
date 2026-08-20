# Product Reset Audit — Vetor como agência digital, não painel técnico (Fase 0)

**Gerado em:** 2026-08-20
**Escopo:** só leitura e diagnóstico — nenhum código foi alterado pra produzir este documento. Aguardando aprovação antes da Fase 1.
**Método:** leitura direta de todas as páginas em `apps/painel/src/app/(painel)/`, do shell/navegação (`SidebarNav.tsx`), dos componentes cliente citados, e consulta SQL real em produção (`rhqkzhiuweiblfkfsqxm`) — nenhuma contagem estimada.

---

## 1. Linha de base real (produção, hoje)

| Fato | Valor |
|---|---|
| Clientes (`clientes`) | 2 — "Vetor (conta de teste)" (Dog King Cambé, 1 usuário) e "Cantina da Ana" (**0 missões, 0 usuários — shell vazio, sem login associado**) |
| Missões (`missions`) | 52 — `completed:23, failed:16, running:11, planned:2` |
| `design_projects` | 12 — **0 com `thumbnail_url` preenchido** |
| `video_projects` | 12 — só **2 com `output_storage_path`** (10 nunca renderizaram o final) |
| `reference_library_items` | 2 |
| `design_flows` (templates) | 1 |
| `artifacts` por tipo | `copy:22, document:16, plan:14, image:16, report:2` — 74% (52/70) são texto, não visual |
| `entregas` (canal legado WhatsApp) | 2 |
| `agent_runs` com custo real > 0 | 65 |

Esses números são a prova objetiva por trás dos 10 problemas listados no prompt — cada um está referenciado com o dado real correspondente na seção 5.

**Achado adicional relevante pra Fase 8:** hoje **não existe** um jeito de logar e ver um workspace novo/limpo. "Cantina da Ana" existe como linha em `clientes` mas não tem nenhum `usuarios.cliente_id` apontando pra ela — não dá pra entrar nela. A única conta logável é a "Vetor (conta de teste)", saturada com 52 missões históricas da Dog King Cambé. Confirma o problema 9 na íntegra.

---

## 2. Mapa de rotas (o que existe de verdade, hoje)

Navegação real (`SidebarNav.tsx`) — agrupada como departamentos de agência:

```
VETOR (núcleo)                    → /dashboard
Operação    → Missões             → /missoes , /missoes/[id]
            → Solicitações        → /solicitacoes
Criação     → Design              → /design , /design/editor , /design/editor/[projectId]
            → Videomaker          → /videomaker , /videomaker/editor , /videomaker/editor/[projectId]
Crescimento → Tráfego             → /trafego
            → Planejamento        → /planejamento
Biblioteca  → Entregas            → /entregas
            → Referências         → /referencias
            → Templates           → /templates
Contexto    → Negócio             → /configuracoes/negocio
Sistema     → Conexões            → /conexoes

Fora do menu (rotas existem, sem entrada de navegação):
            /conteudo, /insights
```

| Rota | Componente servidor | Dado real consultado | Componente cliente | Observação estrutural |
|---|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | `missions` (20 recentes), `approvals` pendentes, `demandas` pendentes | `VetorCockpit.tsx` (430 linhas — núcleo + chat + missão em destaque) | Único ponto de entrada "conversacional"; tudo mais é navegação de página |
| `/missoes` | `missoes/page.tsx` | `missions` (todas, sem paginação) | `StatusBadge` | Lista plana, sem agrupar por campanha/cliente/período |
| `/missoes/[id]` | `missoes/[id]/page.tsx` | `missions`, `mission_steps`, `approvals`, `artifacts` (do mission_id) | `VetorMissionTimeline`, `MissionCanvas` (colapsado atrás de `<details>`) | É a tela mais completa do produto hoje — mas só alcançável clicando numa missão específica, nunca a partir de "Design" ou "Vídeo" diretamente |
| `/design` | `design/page.tsx` | `design_projects` (30 recentes, com join `missions(titulo)`), `artifacts` filtrado por `department=design` | `ArtifactLibrary` | **0/12 projetos têm thumbnail** → grid mostra "sem prévia" na maioria dos cards. `p.status` é impresso **cru** (`draft`, `awaiting_approval`, `approved`, `archived`) sem passar por `StatusBadge` — único lugar do produto com esse gap confirmado |
| `/design/editor` , `/design/editor/[projectId]` | idem | `design_projects` (canvas_json + URLs assinadas) | `DesignProjectEditor.tsx` (Fabric.js, camadas reais) | Editor técnico já é bom (camadas reais, logo travada) — problema é chegar até ele, não o editor em si |
| `/videomaker` | `videomaker/page.tsx` | `video_projects` (30 recentes, join `missions(titulo)`), `artifacts`+`buscarVideosFinalizados` | `VideomakerUpload.tsx`, `ArtifactLibrary` | 10/12 projetos sem `output_storage_path` — nunca chegaram no render final |
| `/videomaker/editor/[projectId]` | idem | `video_projects` (timeline_json + clip URLs + output URL) | `VideoProjectEditor.tsx` | Timeline/captions/preview existem no schema; UI de revisão final (aprovar → entregar) não é um fluxo guiado |
| `/referencias` | `referencias/page.tsx` | `reference_library_items` (só 2 linhas, `cliente_id.eq OR is.null`), `reference_collections`, `business_assets`, `reference_video_profiles` | `ReferenciasPainel.tsx` (644 linhas) | Sem seed curado — biblioteca "curada pelo Vetor" (`cliente_id is null`) está vazia hoje; tela começa como formulário, não como galeria |
| `/templates` | `templates/page.tsx` | `design_flows` (1 linha) | `TemplatesPainel.tsx` (240 linhas) | Schema (`design_flows`, migration `0031`) só tem `nome, descricao, department, tarefa_template, tags, vezes_usado` — **não existe coluna pra thumbnail, objetivo, setor, formato, exemplo, campos guiados, assets necessários, variações ou etapas**. "Usar no chat" só copia texto pro Command Bar |
| `/planejamento` | `planejamento/page.tsx` | `artifacts` (`type=plan`), `missions` com hipótese | client component `GerarPecasCampanha.tsx` embutido no card | Documento renderizado como Markdown longo; "Gerar peças da campanha" já existe (rodada anterior) mas cria uma missão nova a cada clique, sem calendário visual nem status por peça |
| `/entregas` | `entregas/page.tsx` | `buscarArtefatos()` (todos os departamentos) + `buscarVideosFinalizados()` + `entregas` legado | `EntregasPainel.tsx` (48 linhas) | Um **único grid filtrado por departamento** (Tudo/Design/Vídeo/Planejamento/Campanhas/Resultados) — nunca agrupado por campanha. 52/70 artifacts são copy/document/plan, dominam visualmente sobre as 16 imagens |
| `/trafego` | `trafego/page.tsx` | `campanhas_trafego`, `trafego_analises`, `connections` (meta_ads) | `TrafegoPainel.tsx` | Bloqueado por credencial Meta (item já documentado em `STATUS-REAL-ATUAL.md`), fora do escopo deste reset |
| `/solicitacoes` | `solicitacoes/page.tsx` | `demandas` + `solicitacoes` unificadas | — | Já bem estruturado (3 seções por status), não citado como problema no prompt |
| `/conteudo` (fora do menu) | `conteudo/page.tsx` | `conteudo_social` | — | Órfã — papel coberto por Design/Videomaker/Entregas, mas rota continua acessível por URL direta |
| `/insights` (fora do menu) | `insights/page.tsx` | `relatorios`, `log_agentes` | — | Órfã, mesma situação |
| `/configuracoes/negocio` | `configuracoes/negocio/page.tsx` | `business_profiles`, `brand_kits`, `connections` | `OnboardingWizard.tsx` | Fora do escopo do reset (é onboarding/perfil, não criação) |
| `/conexoes` | `conexoes/page.tsx` | `connections` | `ConexoesPainel.tsx` | Fora do escopo do reset |

**Componentes-chave reutilizáveis pras Fases seguintes** (não recriar):
- `ArtifactLibrary.tsx` — grid de card já com thumbnail/tipo/status/link-pra-missão; é a base certa pra evoluir pra "galeria de campanha" (Fase 6), não substituir.
- `StatusBadge.tsx` — já traduz a maioria dos status técnicos pro português (achado: **isso já foi corrigido numa rodada anterior desta sessão** — ver seção 5, item 10, nuance importante).
- `MissionCanvas.tsx` + `VetorMissionTimeline.tsx` — já mostram progresso etapa-a-etapa com status ao vivo; é a fonte certa pro "painel de progresso" pedido na Fase 4, não uma tabela nova.
- `criarMissaoDeIntencao()` (orchestrator) — todo fluxo de "criar uma peça"/"gerar campanha" novo deve continuar passando por aqui, nunca um caminho paralelo.

---

## 3. Fluxo atual vs. fluxo desejado

### Fluxo atual (o que realmente acontece hoje)

```
Cliente digita no chat (dashboard)
      │
      ▼
Vetor propõe missão (VetorIntentCard) ──── OU ──── Cliente navega manualmente pra
      │                                             /design, /templates, /referencias
      ▼                                             (sem ponte entre eles: escolher
Cliente confirma                                     uma referência não inicia nada;
      │                                              "usar template" só preenche o
      ▼                                              chat de novo)
Missão criada (mission_steps: design/copy/…)
      │
      ▼
Etapas de baixo risco rodam sozinhas → produzem
BRIEFING (documento) — pela política atual, nunca
uma peça visual final sem aprovação/custo explícito
      │
      ▼
Cliente só vê o resultado se for em /missoes/[id]
(timeline técnica) ou /entregas (grid misto, sem
agrupar por campanha) ou /design (card "sem prévia")
      │
      ▼
Pra virar peça visual de verdade, precisa de uma
ação manual separada (gerar_imagem/criar_peca_de_design),
sem um botão único "aprovar e criar as opções"
```

### Fluxo desejado (conforme o prompt mestre)

```
pedido do cliente
   → briefing amigável (linguagem natural, sem formulário técnico vazio)
   → referências e direção visual (galeria, não formulário)
   → proposta de execução (resumo: "vou criar 3 direções usando X, Y, Z")
   → aprovação (uma ação simples, custo/risco já calculado)
   → geração/edição (resultado visual real, não só documento)
   → crítica (DesignCritic já existe — reaproveitar, não recriar)
   → revisão (cliente edita headline/CTA/logo sem gerar de novo)
   → entrega (organizada por campanha, com preview real)
```

**A distância entre os dois fluxos hoje:** as peças técnicas de cada etapa já existem (Mission Orchestrator, Policy Engine, DesignCritic, camadas Fabric editáveis, timeline de vídeo) — o que falta é a state machine de UX que liga uma etapa visualmente à próxima, e a tradução de cada status técnico pro que o cliente precisa decidir naquele momento.

---

## 4. Tabela: rota → trabalho do usuário → problema atual → experiência desejada

| Rota | O que o cliente quer fazer aqui | Problema atual (com evidência) | Experiência desejada |
|---|---|---|---|
| `/design` | Pedir uma peça nova, ver o que já foi feito, reaproveitar uma referência/template | 0/12 projetos com thumbnail (grid mostra "sem prévia"); `status` impresso cru em inglês; não existe ação "criar peça nova" guiada — só um link "+ Novo design" pro editor técnico vazio | Departamento de criação: botões de entrada por intenção (nova peça / referência / template / campanha), seções "Trabalhando agora" / "Minhas campanhas" / "Projetos recentes" / "Biblioteca visual" |
| `/referencias` | Se inspirar antes de pedir, sem escrever um brief do zero | Biblioteca curada (`cliente_id is null`) tem **0 linhas** hoje; tela é essencialmente um formulário de URL/Drive; sem busca por intenção ("quero algo elegante") | Galeria com seed curado por categoria + "minhas referências"; busca por intenção; ação direta "usar como inspiração" que já inicia uma missão |
| `/templates` | Reaproveitar uma peça que já funcionou, sem escrever prompt técnico | `design_flows` só tem 1 linha e o schema não suporta thumbnail/objetivo/setor/formato/exemplo/campos guiados — "usar" só copia texto pro chat | Cada template como receita completa (thumbnail, objetivo, campos guiados, exemplo de resultado); clicar "usar" mostra resumo da missão antes de rodar |
| `/planejamento` | Ver o plano do mês e transformar em peças reais | Documento Markdown longo; "Gerar peças da campanha" cria missão nova a cada clique sem calendário visual nem status por peça (mission_steps não tem link visual de volta pro item do calendário) | Calendário visual por campanha, status amigável por peça, geração controlada com resumo prévio |
| `/entregas` | Ver e baixar o que foi entregue, organizado como cliente entende (por campanha) | Grid único filtrado por departamento; 52/70 artifacts são texto (copy/document/plan) dominando sobre as 16 imagens; sem agrupamento por campanha | Galeria por campanha com abas Design/Vídeo/Copy/Planejamento/Resultados, preview real, ação de aprovar/baixar/abrir editor |
| `/videomaker` | Editar um vídeo e receber o resultado final | 10/12 projetos sem `output_storage_path` — nunca chegaram no render final; tela inicial não deixa claro por que o render não aconteceu | Fluxo guiado importar → referência → objetivo → preview → timeline → captions → render → aprovação, com razão explícita quando algo está pendente |
| `/missoes` , `/missoes/[id]` | Acompanhar o que o Vetor está fazendo | Já é a tela mais completa (timeline + canvas), mas só alcançável clicando numa missão específica — nunca a partir de Design/Vídeo diretamente | Continua existindo como fonte de verdade técnica, mas os departamentos (Design/Vídeo/Planejamento) passam a refletir o mesmo progresso na linguagem do cliente, sem obrigar a navegar até aqui |
| conta de teste (geral) | Avaliar o produto como cliente novo | Só existe 1 conta logável, saturada com 52 missões históricas da Dog King; "Cantina da Ana" existe mas não tem usuário associado — não dá pra logar nela | Workspace limpo selecionável + workspace Dog King separado, sem misturar histórico de 2025 no fluxo padrão |

---

## 5. Confirmação dos 10 problemas listados no prompt (com evidência real)

1. **`/design` cards "sem prévia"** — confirmado: `select count(*) from design_projects where thumbnail_url is not null` = 0 de 12.
2. **`/referencias` vazia, sem banco curado** — confirmado: só 2 linhas em `reference_library_items`, nenhuma com `cliente_id is null` (curada).
3. **`/templates` só texto salvo** — confirmado: schema de `design_flows` não tem coluna pra thumbnail/objetivo/setor/formato/exemplo/campos guiados/assets/variações/etapas/aprovação.
4. **`/planejamento` Markdown longo, botão repetido** — confirmado por leitura direta do componente; cada clique em "Gerar peças da campanha" cria uma missão nova (sem idempotência por campanha).
5. **Missão para antes do resultado visual** — confirmado e é uma decisão de política deliberada da rodada anterior (nunca gerar imagem paga sem aprovação explícita) — a Fase 5 do prompt pede exatamente a camada de aprovação que fecha esse loop, não uma remoção da trava.
6. **`/videomaker` sem preview rico/fluxo de revisão** — confirmado: 10/12 projetos sem render final.
7. **`/entregas` dominada por cards de texto** — confirmado: 52/70 artifacts são copy/document/plan.
8. **Geração em lote deliberadamente sem geração final automática** — confirmado (é o comportamento correto documentado em `GRAVYX-UPGRADE-AUDIT.md`, Rodada E/H — inclusive um bug real de geração paga sem aprovação foi encontrado e corrigido nesta sessão). Fica exatamente como está até a Fase 5 definir a camada de aprovação.
9. **Conta de teste dominada por histórico da Dog King** — confirmado: único cliente com dado é "Vetor (conta de teste)" = Dog King Cambé, 52 missões; o outro cliente (Cantina da Ana) não tem usuário associado, não é logável.
10. **Status técnicos sem tradução** — **parcialmente confirmado, com nuance real**: `StatusBadge.tsx` já traduz a maioria dos status (`awaiting_approval` → "Aguardando aprovação", `draft` → "Rascunho", `pending` → "Pendente" — corrigido numa rodada anterior desta mesma sessão). O gap real e concreto está em `/design/page.tsx`, onde `design_projects.status` é impresso **cru** (nunca passa por `StatusBadge`), e no fato de que mesmo as traduções existentes são genéricas (não dizem *o quê* está sendo aprovado, por quem, ou qual a próxima ação do cliente) — exatamente o que a Fase 4 do prompt propõe resolver com um vocabulário de status por peça, não uma tradução literal.

---

## 6. O que não pode quebrar (reafirmando as restrições do prompt)

- Mission Orchestrator (`criarMissaoDeIntencao`, `processarPlanMission`, `avancarMissao`) continua sendo a única fonte de execução — nenhuma reorganização de UX deve inventar um segundo caminho de criação de missão.
- `mission_steps.depende_de` continua sendo a fonte de verdade do grafo — `MissionCanvas.tsx` já é só visualização; não criar uma tabela de grafo nova.
- Design V1 (Fabric.js, camadas reais, DesignCritic) e a timeline do Videomaker (schema de 18 estágios, 5 implementados) continuam intocados — a Fase 5/7 reorganiza a *apresentação* desse pipeline, não o pipeline em si.
- RLS não muda nesta rodada.
- Nenhum crédito/preço nesta rodada (Rodada G do Gravyx segue explicitamente adiada, como já registrado em `GRAVYX-UPGRADE-AUDIT.md`).
- Geração paga automática sem aprovação explícita continua proibida — inclusive reforçada nesta sessão (fix do achado de `criar_peca_de_design` rodando sem aprovação, ver `GRAVYX-UPGRADE-AUDIT.md` Rodada H).

---

**Fim da Fase 0. Nenhum código foi alterado. Aguardando aprovação antes de iniciar a Fase 1 (Design Command Center).**
