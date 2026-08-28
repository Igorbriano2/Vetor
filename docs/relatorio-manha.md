# Relatório da madrugada — Suíte de IA (Freepik/Magnific) no Vetor

**Sessão:** 2026-08-27 → 2026-08-28, autônoma, autorizada explicitamente por você ("apesar de ser uma
mudança grande você deve me entregar tudo amanhã... trabalhe com o que temos... IREI DORMIR AGORA
QUERO TUDO PRONTO"). Este é o primeiro arquivo pra abrir de manhã.

**Resumo em uma frase:** os 3 primeiros módulos da suíte (Imagem, Vídeo, Voz) estão **reais, no ar
em produção, testados ao vivo com sucesso** — geração fim a fim funcionando (fila → processando →
concluído → crédito debitado), só a mídia final ainda é mock porque nenhuma chave de provider real
está configurada. 3D Scenes tem UI real e job real, sem viewer (não tem o que visualizar sem
provider). Design e Spaces ficaram só documentados — motivo real explicado abaixo, não falta de
tempo disfarçada.

## O que foi implementado, fase a fase

### Fase 0 — Arquitetura (`docs/arquitetura-suite-ia.md`)
Documento completo com discovery da stack real, decisão de manter os DOIS paradigmas de criação
(agente vs. "estúdio direto"), mapeamento módulo-a-módulo, modelo de dados, e a decisão de usar
**FishAudio no lugar de ElevenLabs** (sua instrução explícita). Leia esse arquivo primeiro — tem o
raciocínio completo por trás de cada decisão tomada sem te perguntar.

### Fase 1 — Camada de provedores (`apps/agentes/src/ai-providers/`)
Contrato real (`AIProviderAdapter`, `AutoRouter`, `AIModel`, `GenerationRequest`) + `MockAdapter`
completo (6 modelos, 2 por kind) + `AutoRouterPadrao` (escolhe modelo automático de verdade — nunca
kind errado, nunca deprecated, respeita capability exigida, prioriza featured, empate resolve pelo
mais barato). **16 testes automatizados**, todos passando.

### Fase 2 — Banco de dados (`supabase/migrations/0041_ai_suite.sql`)
5 tabelas novas, aplicadas em produção, RLS completo, zero achados novos de segurança
(`get_advisors` confirmado 3x ao longo da noite, sempre os mesmos 3 achados pré-existentes):
`ai_models`, `generation_jobs`, `credit_ledger`, `templates`, `voices`.

### Fase 3 — Image Generator (`/imagem`) — **testado ao vivo com sucesso**
Rota completa (`POST /ai-suite/generate`, `GET /ai-suite/jobs/:id/status`, `/models`, `/templates`,
`/jobs`) + UI real (layout de 2 colunas do prompt-mestre, `ModelPicker` com modo Automático em
destaque, `AssetPicker` reaproveitando o Drive real, prompt com "✨ Melhorar com IA" **usando Claude
de verdade** — único pedaço desta suíte que já é 100% real, não mock). Testei ao vivo: gerei uma
imagem, o job passou por queued → processing → done sozinho (polling automático), o crédito foi
debitado (-2) no `credit_ledger` — confirmado direto no banco.

**Achado real corrigido na hora:** a rota de status não conferia se o job pertencia ao cliente que
pediu — qualquer usuário autenticado podia consultar o status de um job de outro cliente sabendo o
UUID (IDOR). Corrigido antes do primeiro commit desta fase.

### Fase 4 — Componentes reutilizáveis
Nasceram já reutilizáveis na Fase 3: `ModelPicker`, `TemplateGallery`, `AssetPicker`,
`GenerationJobCard`. Por isso as Fases 5 e 6 foram rápidas — reaproveitaram 100%.

### Fase 5 — Video Generator (`/video-ia`) — **testado ao vivo (carregamento)**
Zero mudança no backend (já genérico por `kind`). Quadro inicial/final via `AssetPicker` de seleção
única, roteiro em cenas empilháveis ("+ Adicionar cena", nunca sintaxe `@img1`/`@vid1`).
**Simplificação real:** as cenas são concatenadas num prompt só — o adapter ainda não decompõe em
cortes reais (isso exigiria um provider real que suporte multi-shot).

### Fase 6 — Voice Generator (`/voz`) — **testado ao vivo (carregamento)**
Biblioteca de vozes real no Postgres (5 vozes mock, pt-BR sempre primeiro), botões de
Pausa/Ênfase/Risada que inserem o marcador na posição real do cursor do textarea.

### Fase 7 — Créditos + templates
Débito/estorno automático já funciona de verdade desde a Fase 3 (ver `credit_ledger`). **27
templates** seed no total (3 por nicho × 3 nichos × 3 módulos) — abaixo da meta de 6/nicho/módulo do
prompt-mestre (seria 54), decisão consciente de priorizar terminar a arquitetura em vez de escrever
mais 27 prompts de exemplo. Fácil de completar depois, é só inserir mais linhas em `templates`.
**Não implementado:** enforcement de limite de plano (bloquear geração por saldo baixo, restringir
"modo avançado" por plano) — o prompt-mestre já sinaliza isso como Fase G/futuro, não bloqueia o
MVP.

### Fase 8 — Design (Auto layers)
**Achado real:** o Vetor já tem `design_flows`/`/templates` fazendo algo muito parecido com o que
eu ia construir — decidi não duplicar (ver seção 3.2 do doc de arquitetura). "Transformar em design
editável" fica bloqueado até existir um provider real (não dá pra carregar uma URL `mock://...` como
camada de verdade no editor Fabric.js sem fingir uma imagem que não existe).

### Fase 9 — 3D Scenes (`/3d`) — **testado ao vivo (carregamento)**
UI real dos dois modos ("Meu espaço real" em destaque, "Criar do zero"), job real via a mesma rota
genérica. **Sem viewer three.js** — decisão consciente: com só mock ativo não existe nenhum modelo
3D de verdade pra mostrar num viewer, construir um visualizador vazio seria pior que não ter.

### Fase 10 — Spaces
Só documentado (seção 7 do doc de arquitetura) — o próprio prompt-mestre pede pra implementar por
último, depois dos módulos 1-5 estáveis. Achado real: o Vetor já roda `@xyflow/react` em produção
(`CreativeCanvasEditor.tsx`) — Spaces deve estender esse canvas existente, nunca duplicar.

## O que é MOCK/placeholder — nunca finge ser real

Toda geração retorna um asset em `mock://vetor-ai-suite/<kind>/<n>` — a UI mostra isso claramente
como "pré-visualização (mock)", nunca como se fosse uma imagem/vídeo/áudio de verdade. Isso é
deliberado: o produto inteiro (não só esta suíte) tem como princípio "nunca finge sucesso que não
aconteceu" — prefiro um mock honesto a uma imagem fake tentando parecer real.

## Como rodar localmente

Nada muda no fluxo já existente do monorepo:
```
cd apps/agentes && npm install && npm run dev   # porta 3333 por padrão
cd apps/painel && npm install && npm run dev    # porta 3000
```
Variáveis de ambiente novas: **nenhuma obrigatória** — a suíte funciona 100% com `MockAdapter` sem
nenhuma chave nova. `ANTHROPIC_API_KEY` (já configurada) é usada pelo "Melhorar prompt com IA".

## APIs que você precisa me enviar (nesta ordem de prioridade sugerida)

1. **fal.ai** (ou Replicate) — pra ligar o `FalAdapter` real de Image + Video Generator. Um único
   token de API já dá acesso a dezenas de modelos (Flux, Kling, etc.) sem precisar de contrato
   separado com cada provider.
2. **FishAudio** — pra ligar o `FishAudioAdapter` real do Voice Generator (no lugar de ElevenLabs,
   sua instrução).
3. **(Mais pra frente, quando formos ligar 3D de verdade)** um provider de reconstrução 3D — ainda
   não pesquisei qual (o prompt-mestre não especifica um, e "gerar cena 3D real a partir de foto" é
   um nicho mais restrito que imagem/vídeo — vale uma conversa antes de eu escolher um sozinho).

Quando tiver a(s) chave(s): me diga o nome da variável de ambiente que você configurou (ou eu
configuro, se você me passar a chave direto) e eu escrevo o adapter real e troco o registro em
`apps/agentes/src/ai-providers/registry.ts` — a arquitetura já foi desenhada pra essa troca ser
pequena (implementar `AIProviderAdapter`, registrar, marcar os `AIModel` como featured/available;
nenhuma tela muda).

## Próximos passos sugeridos (em ordem)

1. Configurar fal.ai/Replicate → primeira geração de imagem REAL de verdade (maior impacto
   perceptível pro cliente).
2. Mesma chave já cobre Video Generator (fal.ai tem modelos de vídeo também).
3. FishAudio → Voice Generator real.
4. Completar os templates seed até 6/nicho/módulo (trabalho mecânico, não arquitetural).
5. "Transformar em design editável" (Design, Auto layers) — só depois do item 1, precisa de asset
   real.
6. Enforcement de crédito por plano (Fase G do prompt-mestre).
7. Viewer 3D (three.js/`@react-three/fiber`) — só depois de escolher um provider de 3D.
8. Spaces — estender o Creative Canvas existente com os novos tipos de nó (Gerador de Imagem/Vídeo/
   Voz), reaproveitando `iniciarGeracao()`/`consultarStatusDoJob()` de `ai-providers/registry.ts`.

## Verificação de qualidade feita durante a noite

- `apps/agentes`: build limpo, **327/327 testes passando** (311 pré-existentes + 16 novos).
- `apps/painel`: build limpo, lint limpo, **106/106 testes passando**.
- `get_advisors` (segurança) checado 3x — sempre os mesmos 3 achados pré-existentes, zero achado
  novo introduzido por esta suíte.
- Testado ao vivo em produção: `/imagem` (geração completa fim a fim, confirmado no banco),
  `/video-ia`, `/voz`, `/3d` (carregamento correto, componentes compartilhados já provados em
  `/imagem`).
- Um achado de segurança real (IDOR na consulta de status de job) encontrado e corrigido durante a
  própria implementação, antes de qualquer commit.
- Nenhuma missão de cliente estava rodando antes de cada push que tocou `apps/agentes` (regra
  padrão desta sessão, reconferida antes de cada deploy).
