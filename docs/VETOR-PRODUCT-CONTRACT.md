# Vetor Manager — contrato de produto (Fase 0 + registro de execução)

**Gerado em:** 2026-08-20
**Escopo:** consolidação da camada de navegação/apresentação do Vetor em torno de quatro áreas
conversacionais, sem reescrever nenhum sistema já existente (Mission Orchestrator, Supabase, RLS,
workspaces, agentes especialistas, Design V1/V2, Videomaker). Este documento cobre a Fase 0 pedida
(auditoria + contrato) e, como as fases seguintes já foram executadas na mesma sessão, também registra
o resultado real de cada uma — não é só planejamento, é o estado final.

**Reconciliado contra:** `docs/STATUS-REAL-ATUAL.md` (19/08), `docs/GRAVYX-UPGRADE-AUDIT.md` (19/08),
`docs/PRODUCT-RESET-AUDIT.md` (20/08), e leitura direta do código real em `apps/painel`/`apps/agentes`
no momento da execução (20/08) — os três documentos anteriores venceram onde havia divergência com o
prompt original, conforme instruído.

---

## 1. Proposta do Vetor

Vetor é o gerente de marketing digital de um pequeno negócio — não um painel técnico de agentes de IA.
O cliente final nunca precisa saber que por trás existe um Mission Orchestrator, um Policy Engine ou
agentes especialistas separados por departamento; ele conversa com "o Vetor" e o Vetor decide quem
faz o quê, pede aprovação quando o risco exige, e entrega o resultado.

## 2. Usuário-alvo

Dono de pequeno negócio local (o cliente de prova real usado em toda esta rodada é a Dog King Cambé,
uma hamburgueria) sem equipe de marketing própria — precisa de peças visuais, planejamento de conteúdo
e gestão de tráfego pago, mas pensa em termos de "preciso divulgar uma promoção", nunca em termos de
"qual agente/ferramenta usar".

## 3. Jornada principal

1. Entra no painel e cai direto na área **VETOR** — o núcleo conversacional (`VetorCockpit.tsx`), não
   uma lista de indicadores.
2. Escreve o que precisa em linguagem natural (texto ou voz).
3. O Vetor consulta o contexto real do negócio (perfil, BrandKit, Drive, memória operacional,
   conexões) via `montarContexto()`, já existente em `specialistRunner.ts`.
4. Se faltar informação, pergunta — só o necessário.
5. Propõe um plano curto ("vou criar 3 direções usando X, Y, Z...") antes de gastar qualquer geração
   paga.
6. Pede aprovação quando o Policy Engine calcula risco `medium`/`critical` (já existente,
   `policyEngine.ts`).
7. Cria/continua uma missão idempotente via `criarMissaoDeIntencao` — único caminho de execução, nunca
   duplicado.
8. Acompanha o progresso em linguagem humana (`pecaStatus.ts`, estendido nesta rodada — ver seção 8).
9. Abre o resultado em **Criações**, revisa, edita, aprova.
10. Consulta o calendário/tráfego em **Planejamento**, ou revisita o contexto do negócio em
    **Negócio**.

## 4. Menu de quatro áreas — mapeamento executado

Navegação anterior: `SidebarNav.tsx` tinha 7 grupos / 11 itens de menu (VETOR, Missões, Solicitações,
Design, Videomaker, Tráfego, Planejamento, Entregas, Referências, Templates, Negócio, Conexões), mais
duas rotas órfãs sem entrada de menu (`/conteudo`, `/insights`).

Navegação atual: **4 links, sem sub-itens** — sub-navegação vive dentro de cada hub de área.

| Área | URL canônica | Absorve (rota antiga → status) | Componentes reaproveitados |
|---|---|---|---|
| **1. VETOR** | `/vetor` | `/dashboard` → **redirect 307** para `/vetor`. `/missoes`, `/missoes/[id]`, `/solicitacoes` → continuam com URL própria, linkadas a partir daqui (menu acende "VETOR" nessas rotas também). `/insights` (órfã) → **redirect 307** para `/vetor`. | `VetorCockpit.tsx` (inalterado) |
| **2. Criações** | `/criacoes` (novo hub) | `/design`, `/videomaker`, `/referencias`, `/templates`, `/entregas` → continuam com URL própria, linkadas a partir do hub (menu acende "Criações" nessas rotas também). `/conteudo` (órfã) → **redirect 307** para `/criacoes`. | `ArtifactLibrary.tsx`, `agruparPorCampanha.ts`, `EntregasPainel.tsx` (reaproveitado tal qual pro filtro "Campanhas"), `DesignCommandCenter.tsx`/`CriarPecaWizard.tsx` (linkados, não embutidos) |
| **3. Planejamento** | `/planejamento` | `/trafego` → **redirect 307** para `/planejamento?aba=trafego` (mesmo `TrafegoPainel.tsx`, agora como segunda aba). | `GerarPecasCampanha.tsx`, `TrafegoPainel.tsx` |
| **4. Negócio** | `/configuracoes/negocio` | `/conexoes` → **redirect 307** para `/configuracoes/negocio?aba=conexoes` (mesmo `ConexoesPainel.tsx`, agora como segunda aba). | `OnboardingWizard.tsx`, `ConexoesPainel.tsx` |

### Decisão explícita — rotas órfãs `/conteudo` e `/insights`

Nenhuma das duas tinha entrada no menu antes desta rodada (já documentado em
`docs/PRODUCT-RESET-AUDIT.md`), e as tabelas que consultam (`conteudo_social`, `relatorios`,
`log_agentes`) têm **0 linhas em produção**. Decisão: **redirect**, não remoção — `/conteudo` →
`/criacoes` (papel de calendário de conteúdo já coberto pela galeria unificada), `/insights` → `/vetor`
(papel de "atividade dos agentes" já coberto pelo acompanhamento de missões). As páginas originais
(`conteudo/page.tsx`, `insights/page.tsx`) foram substituídas pelo redirect — se as tabelas ganharem
dados reais no futuro, a decisão pode ser revertida sem perda (nenhum dado foi apagado, só a rota).

## 5. Capacidades internas preservadas (reaproveitadas, não recriadas)

- Mission Orchestrator completo (`orchestrator.ts`, `stateMachine.ts`, `policyEngine.ts`,
  `missionQueue.ts`) — zero alteração de lógica de execução.
- `criarMissaoDeIntencao` continua o único caminho de criação de missão (`POST /api/missoes` →
  `POST /plataforma/missoes`).
- `mission_steps.depende_de` continua a única fonte de verdade do grafo de execução;
  `MissionCanvas.tsx` continua só visualização.
- Design V1 (Fabric.js, camadas reais, DesignCritic) e Videomaker V1 (timeline de 18 estágios, 5
  implementados) — pipeline intocado, só a apresentação foi reorganizada.
- `ProviderRouter`/`imageProvider.ts` (fallback OpenAI → Gemini) — intocado; esta rodada só passou a
  **mostrar** honestamente quando ele esgota (ver seção 8).
- RLS não mudou nesta rodada — nenhuma policy nova, nenhuma alterada.
- Nenhum crédito/preço implementado ou alterado.

## 6. Rotas antigas e aliases

Todos os redirects usam `redirect()` do Next.js (App Router), que responde **307** por padrão em
Server Components — nenhuma URL antiga foi removida do build, todas continuam resolvendo:

```
/dashboard  → /vetor
/trafego    → /planejamento?aba=trafego
/conexoes   → /configuracoes/negocio?aba=conexoes
/conteudo   → /criacoes
/insights   → /vetor
```

`/missoes`, `/missoes/[id]`, `/solicitacoes`, `/design`, `/design/editor/[projectId]`, `/videomaker`,
`/videomaker/editor/[projectId]`, `/referencias`, `/templates`, `/entregas`,
`/configuracoes/negocio/banco-de-imagens` — **URLs inalteradas**, nenhum redirect necessário (só
saíram do menu de topo, continuam acessíveis por link a partir da área que as absorveu).

Toda referência hardcoded a `/dashboard` no código (root redirect em `app/page.tsx`, fallback do
middleware de auth, `OnboardingWizard.tsx`, `login/page.tsx`, `TrafegoPainel.tsx`,
`TemplatesPainel.tsx`) foi atualizada para `/vetor` — não sobrou nenhum link morto apontando pra rota
antiga.

## 7. Fluxo de aprovação

Inalterado — Policy Engine já existente decide risco por ferramenta declarada na etapa
(`tools/registry.ts`), risco `medium`/`critical` força `awaiting_approval`, aprovação acontece em
`/missoes/[id]` via `VetorMissionTimeline.tsx`. Esta rodada não criou nenhuma tela de aprovação nova.

## 8. Vocabulário de status de peça — extensão real (Fase 2)

`pecaStatus.ts` (Fase 4 do reset de produto) já tinha 7 dos 8 rótulos pedidos originalmente ("Escolha
uma direção" continua um gap conhecido e documentado, exige um campo de agrupamento real que não
existe hoje — `mission_steps.peca_id` — decisão de não fabricar um heurística frágil de parsing de
texto).

Nesta rodada, inspirado na transparência de fallback de provedor da Gravyx: quando o `ProviderRouter`
esgota todos os provedores de geração de imagem (`ImagemIndisponivelError`), o especialista agora
propaga um **sinal estruturado real** (`AgentResult.imagemIndisponivel: boolean`, nunca inferido por
parsing de texto do `summary`) até `mission_steps.resultado` (jsonb, sem migration nova). O painel lê
esse sinal e mostra "Provedor de imagem indisponível — briefing pronto" em vez da frase técnica crua
de erro. 9 testes novos cobrindo `pecaStatus.ts` (o arquivo não tinha suíte própria antes).

## 9. Estado real do `resolverClienteAtivo()` (workspace switcher)

Antes desta rodada: `dashboard`, `design`, `videomaker`, `entregas`, `layout.tsx`, `/api/workspace`.
**Fora do padrão**: `/api/missoes` (o proxy de criação de missão — corrigido no início desta sessão,
antes mesmo do prompt do Vetor Manager, já que uma missão criada com o workspace trocado nascia sob o
`cliente_id` do próprio admin por engano), `referencias`, `templates`, `planejamento`,
`configuracoes/negocio`, `trafego`, `conexoes`.

Depois desta rodada: **todas as páginas que continuam existindo usam `resolverClienteAtivo()`** —
`referencias`, `templates`, `configuracoes/negocio` e `planejamento` migrados diretamente;
`trafego`/`conexoes` viraram redirects para páginas que já usam o padrão certo, então não precisam de
migração própria. Corrigido de passagem: `/planejamento` nunca filtrava `artifacts`/`missions` por
`cliente_id` (só RLS implícito) e `/trafego` nunca filtrava `campanhas_trafego`/`trafego_analises` —
ambos corrigidos como parte da migração pro padrão novo.

**Gap conhecido, não corrigido nesta rodada** (fora do escopo do prompt): `buscarVideosFinalizados()`
em `fetchArtifacts.ts` não recebe `clienteId` e não filtra por ele — usado em `/entregas` (já existia)
e agora também em `/criacoes`. Para um usuário comum isso não vaza nada (RLS ainda protege), mas pro
`admin_vetor` com o workspace switcher, um vídeo finalizado de outro cliente pode aparecer misturado.
Pré-existente, não introduzido por esta rodada — registrado aqui para uma rodada futura.

## 10. Bloqueios operacionais conhecidos (não são bugs de código, não reabrir como regressão)

- **Crédito OpenAI esgotado / cota Gemini sem billing** — nenhuma geração real de imagem funciona hoje
  em produção. `ProviderRouter` correto e testado; fail-closed confirmado (Fase 2 desta rodada dá
  visibilidade honesta a isso, não resolve o bloqueio financeiro).
- **WhatsApp em `WHATSAPP_MODE=sandbox`** — credenciais reais configuradas, zero mensagem real recebida
  até agora.
- **STT/TTS credenciados, nunca provados ao vivo em produção** — Fase 6 desta rodada adicionou o aviso
  de "recurso em desenvolvimento" na UI (`VetorCockpit.tsx`), mas o smoke test real de
  voz→texto→resposta pedido pelo prompt mestre **não foi executado**: exige uma sessão autenticada de
  usuário real (cookie de login) ou o `INTERNAL_API_TOKEN` de produção pra chamar `apps/agentes`
  diretamente — nenhum dos dois estava disponível para este agente nesta sessão (sem senha de login;
  o token é `SECRET` no DigitalOcean e não pode ser lido de volta pela API de gerenciamento). Não foi
  fabricado nenhum resultado de teste.
- **Wake word customizado ("vetor")** — os 3 modelos ONNX não existem
  (`docs/voice/wake-word-training.md`); já falha honestamente com mensagem clara, não finge funcionar.
- **Tráfego/conexões Meta** — `BLOCKED_CREDENTIAL`, precisa de app Meta aprovado + token real de conta
  de anúncios. Nenhum código resolve isso.

## 11. Critérios de sucesso (Definition of Done, verificado)

1. Usuário entra e entende que o Vetor é o gerente — `/vetor` é a área 1, sempre o primeiro item do
   menu. ✅
2. "Quero divulgar meu serviço" → fluxo de intenção já existente (`criarMissaoDeIntencao`),
   inalterado. ✅ (já provado em rodadas anteriores)
3. Responder perguntas do negócio → `montarContexto()`, inalterado. ✅
4. Aprovar um plano → Policy Engine, inalterado. ✅
5. Vetor escolhe os agentes → `FERRAMENTA_GERACAO_POR_AGENTE`/especialistas, inalterado. ✅
6. Acompanhar progresso, incluindo o caso real de provedor indisponível → **novo nesta rodada**,
   `pecaStatus.ts` + `AgentResult.imagemIndisponivel`. ✅
7. Abrir uma criação ou entrega → `/criacoes` (hub novo) + páginas de departamento preservadas. ✅
8. Preview, editar, aprovar → editores reais (`DesignProjectEditor.tsx`, `VideoProjectEditor.tsx`)
   inalterados, alcançáveis a partir de `/criacoes`. ✅
9. Navegar por apenas quatro áreas, sem rota órfã fora do menu → `SidebarNav.tsx` reduzido a 4 itens;
   `/conteudo`/`/insights` resolvidas como redirect. ✅
10. URLs antigas continuam funcionando via redirect → `/dashboard`, `/trafego`, `/conexoes`,
    `/conteudo`, `/insights`, todas com `redirect()` 307. ✅

**Não verificado com dado real end-to-end nesta rodada** (mesmo bloqueio de crédito/cota já
documentado desde o reset de produto): o passo 6 (provedor indisponível) foi verificado por leitura de
código + testes unitários (9 nesta rodada), não por uma execução real que dispare o
`ImagemIndisponivelError` em produção — não há OpenAI nem Gemini com cota disponível para provocar
isso ao vivo agora.

## 12. Arquivos alterados nesta rodada

**Novos:**
`apps/painel/src/app/(painel)/vetor/page.tsx`, `apps/painel/src/app/(painel)/criacoes/{page,CriacoesGaleria}.tsx`,
`apps/painel/src/lib/campanha/pecaStatus.test.ts`, este documento.

**Reescritos como redirect (conteúdo antigo preservado no histórico do git):**
`apps/painel/src/app/(painel)/{dashboard,trafego,conexoes,conteudo,insights}/page.tsx`.

**Modificados:**
`apps/painel/src/components/shell/SidebarNav.tsx` (menu de 4 áreas),
`apps/painel/src/app/(painel)/{referencias,templates,planejamento,configuracoes/negocio}/page.tsx`
(migração pra `resolverClienteAtivo()` + filtros de `cliente_id` corrigidos),
`apps/painel/src/app/api/missoes/route.ts` (mesma migração, feita no início da sessão),
`apps/painel/src/app/page.tsx`, `apps/painel/src/app/login/page.tsx`,
`apps/painel/src/lib/supabase/middleware.ts`,
`apps/painel/src/components/onboarding/OnboardingWizard.tsx`,
`apps/painel/src/app/(painel)/{trafego/TrafegoPainel,templates/TemplatesPainel}.tsx`
(referências a `/dashboard` → `/vetor`),
`apps/painel/src/lib/campanha/pecaStatus.ts`, `apps/painel/src/components/VetorMissionTimeline.tsx`,
`apps/painel/src/components/VetorCockpit.tsx` (aviso de voz),
`apps/agentes/src/agents/specialistRunner.ts` (sinal estruturado `imagemIndisponivel`).

## 13. Arquivos que não foram e não devem ser alterados

`apps/agentes/src/missions/{orchestrator,stateMachine,policyEngine}.ts`,
`apps/agentes/src/integrations/imageProvider.ts` (lógica do `ProviderRouter` em si),
`apps/agentes/src/negocio/{designProjects,designCritic,designLayout,designComposer,videoPipeline}.ts`,
qualquer arquivo de migration existente (`supabase/migrations/*.sql` — nenhuma migration nova foi
necessária nesta rodada, todo campo novo usado já existia como jsonb livre), `apps/render`,
credenciais/env vars de qualquer provedor.

## 14. Verificação executada

- `apps/painel`: `npm run build` + `npm run lint` limpos após cada fase; suíte de testes crescendo de
  63 → 72 (9 testes novos de `pecaStatus.ts`), sem regressão.
- `apps/agentes`: `npx tsc --noEmit` limpo; suíte de testes 236/236 sem regressão após a mudança em
  `specialistRunner.ts`.
- Cada fase commitada separadamente (ver `git log`), mensagens em português explicando o quê e o
  porquê.
- Deploy em produção e verificação ao vivo: ver commit de deploy final (após este documento).
