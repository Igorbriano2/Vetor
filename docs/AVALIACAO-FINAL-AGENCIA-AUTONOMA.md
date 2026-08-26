# Vetor como agência digital autônoma — avaliação final

Relatório final da rodada de auditoria completa do Gravyx (3 auditorias — visual, node-a-node,
funcional/áreas) cruzada com o estado real do Vetor, mais as melhorias implementadas nesta sessão.
Segue a estrutura pedida: o que já funciona bem, o que foi melhorado, o que foi implementado, o que
falta, o que não deu pra implementar, gargalos, oportunidades, prioridades, e a nota de automação
0-100 antes/depois.

## Metodologia

3 rodadas de auditoria no Gravyx (app.gravyx.com.br), sempre em projetos reais criados de propósito,
clicando em cada controle, testando geração real (gastando créditos de propósito), e inspecionando o
DOM renderizado pra extrair receitas de design reais (nunca copiando código-fonte deles — sem acesso
de conta paga ao registry de componentes, e mesmo se houvesse, não seria correto reproduzir código
proprietário literal). Áreas cobertas: Início, Projetos (3 fluxos completos: Criação de carrossel,
Ensaio Fotográfico, Variação de Criativos), Genos (chat), Performance, Instagram, Tarefas. Não
cobertas por falta de relevância pro roadmap de produto: Comunidade (fórum de usuários) e
Treinamentos (cursos em vídeo) — são camada de customer success, não funcionalidade replicável.

## O que já está funcionando bem no Vetor

- **Mission Orchestrator real**: todo pedido passa por entendimento → plano → aprovação → execução →
  evidência, nunca "completed" sem artefato verificável. O Gravyx não tem equivalente — cada node
  gera isoladamente, sem orquestração multi-etapa nem aprovação obrigatória antes de gasto real.
- **DesignCritic**: avaliação automática por visão computacional (12 critérios) antes de qualquer
  peça poder ser marcada concluída — fail-closed por design. Não vi nada parecido no Gravyx.
- **RLS/isolamento multi-tenant real**: confirmado consistente em toda a base desde a Fase 0 desta
  sessão. Pré-requisito pra atender múltiplos clientes com segurança real.
- **Calendário editorial com 13 campos estruturados** (Fase 5 do Vetor Manager V2, sessão anterior) —
  mais completo que qualquer coisa equivalente vista no Gravyx.
- **BrandKit real aplicado automaticamente**: logo oficial nunca desenhada de memória, sempre camada
  travada vinda do Drive real do cliente.

## O que foi melhorado nesta sessão

1. **Node de Resultado com controles reais** (proporção/resolução/modelo/contagem) — antes só texto
   livre descrevendo o que gerar.
2. **Cada um dos 12 tipos de node do Creative Canvas com interface própria pra sua função** (upload
   real, seletor de referência/BrandKit real, seletor de direção de arte, seletor de provider) —
   antes todos caíam no mesmo bloco genérico "Título + Configuração".
3. **Edição direto no node, sem painel lateral** — achado central da 2ª auditoria: nenhum node do
   Gravyx abre painel fora dele mesmo. Reescrita completa do Creative Canvas pra reproduzir esse
   comportamento (dropzone/seletor/textarea dentro do próprio card, menu "⋮" por node).
4. **Vocabulário de Direção de Arte centralizado** — existiam 2 cópias soltas do mesmo enum de 6
   estilos; agora uma fonte única.
5. **Efeitos e animações sutis** (aurora no cockpit, glow em botões, elevação em cards) — pesquisado
   em 21st.dev, adaptado em CSS puro (sem dependência nova) pra um dashboard autenticado, não uma
   landing page.

## O que foi implementado (novo, não existia)

1. **Seletor de IA/modelo no próprio node de Resultado** ("Gemini — Nano Banana" / "OpenAI — GPT
   Image" / Automático) — exatamente o pedido explícito de poder escolher a IA usada na criação.
2. **"Salvar como receita" a partir do Creative Canvas** — Gravyx deixa qualquer projeto virar
   template reutilizável; o Vetor tinha o equivalente (`design_flows`) mas só alimentado por
   formulário manual, nunca por um fluxo desenhado de verdade.
3. **Visão Kanban de Missões** (`/missoes`) — reagrupamento visual (somente leitura, nunca
   drag-and-drop de status — isso violaria a máquina de estados real da orquestração) dos 12 status
   reais em 5 colunas operacionais. Gap real: o Vetor não tinha nenhuma visão de pipeline, só lista.
4. Toda a reconstrução do módulo de Design/Criações da rodada anterior desta sessão (galeria visual,
   modal Novo Projeto, 8 receitas de agência, editor com camadas reais).

## O que ainda falta (gaps reais confirmados na auditoria, não implementados nesta rodada)

Ordenados por prioridade real pro objetivo "agência autônoma ponta a ponta":

### 1. Publicação direta em redes sociais — **prioridade máxima**
O Gravyx publica e agenda posts/carrosséis/reels direto pro Instagram, sem sair da ferramenta
("Publicar e agendar posts, carrosséis e reels" — testado no menu Instagram deles). O Vetor planeja
o calendário editorial inteiro mas a publicação em si ainda é manual — o ciclo
`Planejamento → Produção → Aprovação → Publicação` para exatamente antes da última etapa.
**Por que não implementei agora**: exige app review da Meta pros scopes
`instagram_content_publish`/`pages_manage_posts` (processo de aprovação externo, dias/semanas, não
é algo que eu resolvo numa sessão) e decisão de produto sobre se o Vetor publica direto via API
própria ou reaproveita a mesma conexão Meta Ads já existente (`connections`, provider `meta_ads`) —
o schema já tem a tabela `connections` pronta pra um novo provider `instagram`, só falta o fluxo OAuth
+ a chamada de publicação em si.
**Como deveria funcionar**: item do calendário editorial em status `aprovado` com `agendado_para`
preenchido → job (o worker já existe, `apps/agentes/src/worker.ts`) publica automaticamente no
horário via Graph API → status vira `publicado` com o `post_id` real salvo.

### 2. Resposta automática a comentários/DMs — **prioridade alta**
Gravyx promete "Responder comentário com DM automático". O Vetor não tem nenhum canal de
engajamento pós-publicação — zero automação de resposta a interações reais dos seguidores.
**Como deveria funcionar**: webhook do Instagram (`comments`/`messages`) → agente novo (ou extensão
do agente de Conteúdo existente) decide se responde automaticamente (regras simples: dúvida sobre
produto/preço/horário) ou escala pra um humano — nunca resposta automática pra reclamação/crise, isso
sempre precisa de aprovação humana.

### 3. Leaderboard de melhores criativos por métrica — **prioridade média**
Performance do Gravyx tem "Top 5 criativos por CPC/CTR/ROAS" ranqueados com um clique. O
`TrafegoPainel` do Vetor mostra métricas agregadas por campanha mas não um ranking de criativos
individuais.
**Como deveria funcionar**: `campanhas_trafego.metricas` já é sincronizado de verdade
(`metaAdsSync.ts`) — falta só ordenar por métrica escolhida e cruzar com o `artifacts`/
`design_projects` de origem pra mostrar o thumbnail real ao lado do número. Sem tabela nova.

### 4. Funil de conversão visual — **prioridade média**
Impressões → Alcance → Cliques → Compras com taxa de queda entre cada etapa, visualização tipo funil.
O Vetor tem os números (`insights` já sincronizados) mas não essa visualização específica.

### 5. Onboarding de conexão Meta simplificado — **prioridade baixa, decisão de produto sensível**
Gravyx conecta clientes através de um "System User" compartilhado da própria Gravyx (Business
Manager deles, visto ao vivo: `BM002 - CC001 - CERVEGELA`), evitando OAuth individual por cliente. O
Vetor usa OAuth por cliente (`connections`, fluxo padrão Meta). **Não recomendo copiar isso sem uma
decisão explícita sua**: um System User compartilhado centraliza risco de compliance/segurança (uma
credencial só com acesso a todos os clientes) — é uma troca real de isolamento por conveniência de
onboarding, não uma melhoria óbvia. Registro como opção, não como recomendação.

### 6. Board de tarefas genérico (não-missão) — **prioridade baixa**
O Kanban que implementei é só de missões reais. Gravyx também tem um board de tarefas soltas
(lembretes, afazeres administrativos sem vínculo com uma missão/geração). Não implementei por ser
baixo valor pro objetivo "agência autônoma" — é gestão de trabalho interno, não produção pro cliente.

## Principais gargalos hoje

1. **Publicação continua manual** — maior gargalo real pro ciclo completo automático.
2. **Zero automação pós-publicação** (engajamento, resposta a comentários).
3. **Onboarding de conexão de anúncios** ainda exige o cliente/agência fazer o OAuth manualmente por
   workspace — funcional, mas fricção real vs. o modelo de System User compartilhado do concorrente
   (trade-off registrado no item 5 acima, não uma correção óbvia).

## Principais oportunidades

1. Fechar o ciclo completo `Planejamento → Publicação → Monitoramento → Otimização` automatizando o
   item 1 — é o que mais aproxima o Vetor de "atender do início ao fim sem intervenção humana".
2. O DesignCritic e o Mission Orchestrator já são vantagens competitivas reais sobre o concorrente
   auditado — vale reforçar esse posicionamento (qualidade automática + rastreabilidade) em vez de só
   perseguir paridade de features.
3. Leaderboard de criativos (item 3) é a melhoria de mais alto retorno por esforço — dado já existe,
   é só apresentação nova.

## Próximas prioridades (ordem recomendada)

1. Publicação automática no Instagram (item 1) — inicia o app review da Meta o quanto antes, é o item
   com maior lead time externo.
2. Leaderboard de criativos no Tráfego (item 3) — rápido, alto retorno, zero risco.
3. Funil de conversão visual (item 4) — mesma lógica, dado já existe.
4. Decisão de produto sobre onboarding de conexão (item 5) — precisa de você, não é técnica.
5. Automação de engajamento (item 2) — deixei por último por ser o que mais precisa de governança
   humana bem desenhada antes de automatizar (risco de resposta errada em público é real).

## Nota de automação — 0 a 100

| | Antes desta sessão | Depois desta sessão |
|---|---|---|
| **Nota** | **52/100** | **61/100** |

**Por quê 52 antes**: o núcleo de produção (entendimento → plano → geração → crítica de qualidade →
aprovação) já era genuinamente automatizado e melhor que o concorrente auditado nesse recorte
específico. Mas o ciclo completo de agência (onboarding → briefing → estratégia → planejamento →
produção → aprovação → **publicação** → monitoramento → performance → relatório → otimização) tinha
dois elos manuais grandes: publicação e engajamento pós-publicação — cada um vale bastante nota porque
são etapas recorrentes, de alto volume, que hoje exigem um humano toda vez.

**Por quê 61 depois**: as melhorias desta sessão (canvas com interface real por node, seletor de IA,
Kanban operacional, "salvar como receita") tornam a PRODUÇÃO mais rápida e menos propensa a erro
humano na configuração — reduz fricção e retrabalho, não é "mais automação" no sentido de "menos
humanos", mas é diretamente parte de "atender mais clientes com o mesmo time". Não subiu mais porque
os dois maiores blocos de automação real que faltavam (publicação, engajamento) continuam manuais —
nenhuma melhoria de UX no canvas fecha esse gap. A próxima sessão que implementar publicação
automática deve mover essa nota de forma muito mais expressiva do que qualquer polish de interface.

---

**Commits desta sessão** (mais recentes primeiro): `29054b7` Kanban de Missões, `7911529` edição
direto no node sem painel lateral, `cd1afac` painel por tipo de node, `34fac96` controles de
formato/variações, `ca6a329` efeitos/animações, `34e2af5` redesign de layout do canvas, `295ad9a`
"Salvar como receita".

**Testes**: 102 testes automatizados passando em `apps/painel` após cada commit. Build e typecheck
limpos. Nenhuma migration nova nesta rodada — tudo aditivo sobre schema já existente.
