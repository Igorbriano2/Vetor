# Vetor Manager + Experiência Visual — Auditoria (Fase 0)

**Gerado em:** 2026-08-20
**Escopo:** só leitura — nenhum código foi alterado pra produzir este documento. Aguardando aprovação
antes da Fase 1.
**Método:** leitura direta do código real (`apps/painel`, `apps/agentes`), com citação de arquivo:linha
para cada afirmação — nenhuma suposição. Reconciliado contra `docs/STATUS-REAL-ATUAL.md`,
`docs/VETOR-PRODUCT-CONTRACT.md`, `docs/GRAVYX-UPGRADE-AUDIT.md` e `docs/PRODUCT-RESET-AUDIT.md`.

---

## 1. Como o texto/áudio atual entra no sistema

Browser → `POST /api/comando` (`apps/painel/src/app/api/comando/route.ts`): resolve o usuário
autenticado via Supabase, busca `usuario.cliente_id` no servidor (nunca confia no corpo da requisição),
e encaminha:

```ts
// apps/painel/src/app/api/comando/route.ts:43-53
const res = await fetch(`${agentesUrl}/plataforma/mensagem`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
  body: JSON.stringify({
    cliente_id: usuario.cliente_id, texto, responder_em_voz: !!body?.responder_em_voz,
    conversation_id: conversationId, usuario_id: user.id,
  }),
});
```

`apps/painel/src/app/api/comando/audio/route.ts` segue o mesmo padrão de auth, mas envia
`audio_base64`/`mime_type` pra `${agentesUrl}/plataforma/audio`.

No backend, `apps/agentes/src/server.ts:37` monta `app.use("/plataforma", plataformaRouter)`. Todo o
router exige auth interna (`routes/plataforma.ts:16`, header `x-internal-token` contra
`INTERNAL_API_TOKEN`, checado em `middleware/internalAuth.ts:5-8`). `POST /mensagem` chama
`processarMensagemPlataforma`; `POST /audio` chama `processarAudioPlataforma`.

## 2. Como contexto, BrandKit, Drive e memória são consultados

Dois caminhos **separados e não conectados entre si**:

**a) Chat do Vetor** (`vetorPlataforma.ts`, o agente que responde no `/vetor`): lê
`business_profiles`/`brand_kits`/conexões e também `memoria_operacional` (as últimas 10 entradas do
cliente) dentro de `buscarContextoDeNegocio()`:
```ts
// apps/agentes/src/agents/vetorPlataforma.ts:216-222
supabase.from("memoria_operacional")
  .select("tipo, conteudo, confianca, origem, created_at")
  .eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(10)
```

**b) Especialistas de execução** (design/vídeo/tráfego/estratégia, rodando dentro de uma etapa de
missão): o contexto é montado em `processarRunAgentStep()` (`orchestrator.ts`), lendo
`business_profiles` (`:456-460`), `brand_kits` (`:462-467`), Drive (`buscarAssetsRelevantes`, só pra
design/vídeo, `:471-474`), tráfego/conexões (só pra tráfego/analítico, `:479-480`) e etapas anteriores
da mesma missão (`:436-438`). `montarContexto()` (`specialistRunner.ts:1459`) é só um **formatador** de
texto sobre esses dados já buscados — não faz nenhuma query própria.

**Achado real e relevante pra Fase 4 (VetorManager)**: os especialistas de execução **nunca leem
`memoria_operacional` de volta** — só o agente de chat lê. Um agente de Design não sabe, por exemplo,
que uma decisão ou preferência foi registrada como memória numa conversa anterior, a não ser que ela
apareça reformulada no resumo da missão. Isso é uma lacuna real, não uma opção de design deliberada —
não há nenhum comentário no código explicando essa assimetria.

Referências aprovadas (`reference_library_items`) são lidas separadamente, só pra design, dentro de
`specialistRunner.ts:1630` (`buscarReferenciasAprovadas`), mescladas como um bloco à parte do que
`montarContexto()` produz.

## 3. Onde a intenção é decidida

Sem classificador dedicado — é uma decisão de tool-choice do próprio LLM. `vetorPlataforma.ts` chama a
Anthropic oferecendo três ferramentas (`REGISTRAR_TICKET_TOOL`, `TRANSFERIR_HUMANO_TOOL`,
`PROPOR_MISSAO_TOOL`, `:418-425`). Se o modelo não chamar `propor_missao`, a resposta é só texto.

`PROPOR_MISSAO_TOOL` (`:36-89`) já tem os campos `categoria` (enum strategy/content/traffic/
design/analytics/support) e `confianca` (high/medium/low) — **já existem hoje**, não são uma extensão
pendente. `risco` de cada etapa **nunca** vem do LLM: é recalculado no servidor a partir das
`ferramentas` declaradas (`avaliarRisco`, ver seção 5).

## 4. Como as perguntas são feitas

Não existe um mecanismo dedicado de "pergunta de esclarecimento" — é inferido depois do fato,
puramente por heurística de texto:
```ts
// apps/agentes/src/agents/vetorPlataforma.ts:371-375
function inferirNextAction(intent: MissaoProposta | undefined, respostaTexto: string): NextAction | undefined {
  if (intent) return "show_plan";
  if (respostaTexto.trim().endsWith("?")) return "ask_clarification";
  return undefined;
}
```
Ou seja: "a resposta termina com `?`" é o único sinal. Funciona na prática (o LLM tende a terminar
perguntas com `?`), mas é frágil — não há um tool schema dedicado tipo `perguntar_esclarecimento` que
force estrutura.

## 5. Como missão e aprovação funcionam

`VetorIntentCard.tsx` (renderizado dentro de `VetorCockpit.tsx`) posta `{plano: intent,
solicitacao_id}` pra `/api/missoes` ao confirmar. O proxy resolve `cliente_id` via
`resolverClienteAtivo()` (nunca do corpo) e encaminha pro backend, que **recalcula o hash do plano e
rejeita se o cliente adulterou algo** (`routes/missoes.ts:35-38`), então chama:

```ts
// apps/agentes/src/missions/orchestrator.ts:184-188
export async function criarMissaoDeIntencao(
  clienteId: string, plano: PlanoConfirmado, confirmacao: ConfirmacaoMissao = {},
): Promise<{ missionId: string; idempotente: boolean }>
```
Idempotente por `solicitacaoId` (devolve a missão já existente se já houver uma linkada). Cada
`mission_step` recebe `risco = avaliarRisco(etapa.ferramentas)` — **sempre recalculado no servidor**,
nunca aceito do plano vindo do cliente.

Decisão aprovação vs. execução automática (`orchestrator.ts:302-327`):
```ts
const algumaPrecisaAprovacao = (etapas ?? []).some((e) => precisaAprovacao(e.risco as Risco));
// se sim: cria approvals pendentes, missão vai pra "awaiting_approval"
// se não: missão vai direto planned → queued → running
```
`precisaAprovacao` (`policyEngine.ts`): `risco` `medium`/`high`/`critical` exige aprovação; só `low`
roda automático. Ferramentas `critical` **nunca** rodam automaticamente mesmo com aprovação prévia —
bloqueio adicional em `orchestrator.ts:441-446` via `bloqueiaExecucaoAutomatica`.

## 6. Como agentes e skills são escolhidos

**Ferramentas** — `tools/registry.ts` (201 linhas), três níveis reais hoje:
- **`low`** (auto-executável): `ler_perfil_negocio`, `ler_brand_kit`, `ler_historico`, `criar_briefing`,
  `criar_copy`/`gerar_copy`, `gerar_design`, `criar_relatorio`/`gerar_relatorio`, `salvar_hipotese`,
  `criar_artefato`, `criar_versao`, `registrar_experimento`, `solicitar_aprovacao`,
  `transferir_humano`, `registrar_ticket`, `agendar_conteudo_social`, `editar_video_timeline`,
  `finalizar_video_com_legendas`, `analisar_video_de_referencia`.
- **`medium`** (exige aprovação): `pausar_campanha_trafego`, `publicar_conteudo_social`,
  `gerar_video_higgsfield`, `gerar_imagem`, `criar_peca_de_design`.
- **`critical`** (nunca automático): `ajustar_orcamento_trafego`, `criar_campanha_trafego`,
  `criar_audiencia`, `enviar_mensagem_externa`, `excluir_recurso`.

Ferramenta desconhecida no registry cai fail-closed em `critical` (`registry.ts:158-163`).

**Skills** — seleção por **substring matching puro**, sem LLM nem embeddings:
```ts
// apps/agentes/src/skills/registry.ts:49-59
export function selecionarSkills(department: SkillDepartment, textoDaEtapa: string, skillsDir?: string): SkillManifest[] {
  const texto = textoDaEtapa.toLowerCase();
  return manifestosPorDepartamento(department, skillsDir)
    .map((manifest) => ({ manifest, matches: manifest.triggers.filter((t) => texto.includes(t.toLowerCase())).length }))
    .filter((x) => x.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .map((x) => x.manifest);
}
```
Conta quantos `triggers` do manifesto aparecem como substring no texto (título+objetivo+hipótese+tarefa
da etapa), carrega só a skill vencedora. 34 skills reais em `apps/agentes/src/skills/skills/`
(`ab-testing`, `ad-creative`, `brand-compliance`, `campaign-analysis`, `content-calendar`,
`video-receipt`, entre outras), cada uma com `manifest.json` + `SKILL.md`.

## 7. Quais hubs já existem

Confirmado ao vivo em produção nesta mesma sessão (`docs/VETOR-PRODUCT-CONTRACT.md`), 4 áreas, sem
sub-itens no menu:

- **`/vetor`** (`VetorCockpit.tsx`) — núcleo visual (`VetorCore`), saudação, campo de texto+voz, link
  "ver missões", indicador de missão ativa quando existe. **Hoje é essencialmente uma tela de chat**,
  sem criações recentes, sem ações rápidas, sem cards de capacidade.
- **`/criacoes`** (novo nesta sessão) — 5 cards de entrada (criar peça/vídeo, usar referência/receita,
  ver entregas) + galeria com filtros (Todas/Imagens/Vídeos/Copies/Campanhas/Rascunhos/Aprovadas),
  reaproveitando `ArtifactLibrary.tsx` (thumbnail real quando há `url`, senão um bloco cinza com o tipo
  em texto) e `EntregasPainel.tsx` (reaproveitado tal qual pro filtro "Campanhas").
- **`/planejamento`** — planejamentos mensais em texto/lista + hipóteses, com aba "Tráfego" (dashboard
  de campanhas, ainda maioria vazia — 0 campanhas reais em produção).
- **`/configuracoes/negocio`** — `OnboardingWizard.tsx` (perfil, BrandKit, Drive) com aba "Conexões".

**Confirmado real e funcional, não placeholder**: `DesignProjectEditor.tsx` (Fabric.js real, camadas
reais, logo travada) e `VideoProjectEditor.tsx` (timeline multi-track com undo/redo real, não uma
prévia estática).

## 8. Quais telas precisam de redesign visual

- **`/vetor`**: maior lacuna apontada pelo prompt — tela central muito vazia comparada ao Gravy X. Não
  tem "criações recentes", "ações rápidas" nem cards de capacidade hoje.
- **`/criacoes`**: a galeria já existe e já usa thumbnail real quando há URL, mas o card é simples
  (sem ação "Editar"/"Aprovar" própria — só "abrir" via link cru pro asset, e "missão" quando há
  `missionId`); não agrupa visualmente por campanha na visão padrão (só no filtro "Campanhas").
- **`/referencias`** (`ReferenciasPainel.tsx`, Fase 2 do Gravyx-upgrade): já tem galeria, filtros por
  categoria curada e análise de estilo real via Claude vision (`reference_image_profiles`/
  `reference_video_profiles`) — mas essa análise **não é resumida em uma frase simples pro cliente**
  hoje (ex: "Você escolheu uma estética editorial, escura e premium"); fica como dado estruturado
  técnico, consultável mas não apresentado.
- **`/planejamento`**: hoje é texto/lista, não um calendário visual em grid por dia/canal.
- **Início de criação**: não existe hoje um modal único "Como você quer começar?" (Vetor / do zero /
  receita) — `/design` tem o wizard de 4 passos, `/templates` tem "Usar este template" que abre o mesmo
  wizard preenchido; são dois pontos de entrada distintos, não um modal unificado.

## 9. Quais arquivos devem permanecer intactos

Mesma lista já validada nas três rodadas anteriores, reconfirmada nesta auditoria:
`apps/agentes/src/missions/{orchestrator,stateMachine,policyEngine}.ts`,
`apps/agentes/src/tools/registry.ts` (só extensão aditiva, nunca remoção/mudança de risco existente),
`apps/agentes/src/agents/specialistRunner.ts` (lógica de execução real — `montarContexto`,
`executarEspecialista`), `apps/agentes/src/integrations/imageProvider.ts` (ProviderRouter),
`apps/agentes/src/skills/*` (mecanismo de seleção), `DesignProjectEditor.tsx`/`DesignCanvasEditor.tsx`
(Fabric.js), `VideoProjectEditor.tsx`+painéis de timeline, todas as migrations existentes, RLS.

## 10. Mudanças mínimas pro fluxo alvo (proposta pra Fase 1+, não implementada ainda)

O "VetorManager" pedido **já existe em ~80% como pipeline real** (`vetorPlataforma.ts` +
`criarMissaoDeIntencao` + Policy Engine + `specialistRunner.ts`) — a tarefa não é construir uma camada
nova de orquestração, é:

1. **Apresentação da home** (`/vetor`): adicionar seção "criações recentes" (reaproveitar
   `buscarArtefatos`/`ArtifactLibrary.tsx` já usados em Criações, só um recorte de 4-6 itens) e "ações
   rápidas" (botões que só preenchem `texto` no command bar e disparam o fluxo já existente — nunca um
   caminho novo).
2. **Cards de Criações**: estender o card de `ArtifactLibrary.tsx` com estado amigável
   (`pecaStatus.ts`, já existente) e ação "editar"/"aprovar" linkando pro editor real
   (`/design/editor/[projectId]`) quando o artefato tiver `designProjectId`.
3. **Resumo em linguagem simples do `ReferenceStyleProfile`**: os campos já existem em
   `reference_image_profiles`/`reference_video_profiles` — falta só uma função pura que traduza os
   campos técnicos (composição/paleta/densidade) numa frase, e um lugar na UI pra mostrá-la.
4. **Modal "Como você quer começar?"**: componente novo e pequeno que decide entre abrir o wizard vazio,
   abrir com uma referência, ou abrir `/templates` — sem duplicar nenhuma lógica de criação de missão.
5. **Fechar a lacuna real da seção 2** (memória não lida pelos especialistas): se entrar no escopo,
   adicionar uma leitura de `memoria_operacional` dentro do contexto montado em
   `processarRunAgentStep()`, mesmo padrão de query já usado em `vetorPlataforma.ts`.
6. **Canvas avançado opcional**: `MissionCanvas.tsx` (já existe, visualização de `mission_steps` como
   nós) já cobre boa parte do pedido — falta só adicionar custo estimado por nó (dado já existe em
   `agent_runs.custo_estimado_centavos`, ver ressalva sobre esse campo em
   `docs/VETOR-PRODUCT-CONTRACT.md` seção 2) e decidir onde ficar visível/colapsável.

Nenhum item acima exige tocar em `orchestrator.ts`, `policyEngine.ts` ou `specialistRunner.ts`'s
lógica de execução — são extensões de apresentação e, no máximo, uma leitura adicional de dado já
existente (item 5).

---

**Parando aqui conforme instruído.** Aguardando aprovação antes de iniciar a Fase 1 (home híbrida do
`/vetor`).
