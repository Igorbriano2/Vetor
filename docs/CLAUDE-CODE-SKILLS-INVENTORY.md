# Inventário de skills do Claude Code (ambiente de desenvolvimento)

**Gerado em:** 2026-08-21 — descoberta local, nenhuma instalação feita.
**Importante:** este documento trata só das skills que ajudam A MIM (Claude Code) a programar o
VETOR. Nenhuma delas é executada pelo VETOR em produção, nenhuma é exposta ao cliente, e nenhuma foi
adicionada ao runtime dos agentes (`apps/agentes/src/skills/`).

## Método de descoberta

- `~/.claude.json` → chave `skillUsage`: registro real de quais skills já foram efetivamente
  invocadas nesta instalação do Claude Code (fonte mais confiável — uso real, não catálogo).
- `~/.claude.json` → chave `pluginUsage`: idem, pra plugins de marketplace.
- `~/.claude/skills/`, `~/.claude/plugins/marketplaces/`: inspeção direta do filesystem.
- Não rodei nenhum comando de instalação (`/plugin install`, `--all` etc.) — só listagem.

**Limitação honesta**: a lista completa de skills que o *harness* me disponibiliza via minha própria
ferramenta de invocação (`Skill`) é injetada dinamicamente a cada sessão e não tenho um comando que a
enumere por fora dessa injeção. Documento abaixo apenas o que tem evidência concreta (uso real
registrado, ou presença confirmada em disco) — não invento nomes de skill que não vi de verdade.

## Matriz

| Skill | Localização | Uso no upgrade | Fases autorizadas | Pré-condições | Risco |
|---|---|---|---|---|---|
| `security-review` | builtin (via ferramenta `Skill`, roda em subagent) | Revisar RLS, upload, URLs assinadas, MIME, XSS, open redirect antes de fechar uma fase que mexe em segurança | Fases 2 (upload), 4 (provider real), 7 (E2E) | precisa rodar dentro de um repositório git — **confirmado**: este repo tem remote real (`github.com/Igorbriano2/Vetor`, branch `main`) | Baixo — leitura, roda em subagent isolado, não altera código sozinha |
| `artifact-design` | bundled (via ferramenta `Artifact`) | Só relevante se eu publicar um Artifact visual (ex: mockup HTML da tela inicial pra você revisar antes de eu codificar de verdade) | Fase 1, se um preview de Artifact for útil | nenhuma | Baixo |
| `artifact-diagramming` | bundled (referenciada pela ferramenta `Artifact`, ainda não invocada nesta sessão) | Diagramas (grafo de nodes do Creative Canvas — Fase 3, fluxo do VetorManager — Fase 0/1) se eu publicar um Artifact explicativo | Fase 0 (este relatório, se eu decidir ilustrar), Fase 3 | só relevante se eu publicar um Artifact | Baixo |
| `Explore` (subagent) | ferramenta `Agent`, `subagent_type: "Explore"` | Levantamento rápido e read-only de arquivos/contratos — **já usado nesta própria Fase 0** pra localizar os arquivos reais listados no prompt | Todas as fases, na etapa de pesquisa | nenhuma | Baixo — só leitura, sem `Edit`/`Write` |
| `Plan` (subagent) | ferramenta `Agent`, `subagent_type: "Plan"` | Desenhar a estratégia de implementação técnica antes de uma fase grande (ex: Fase 3 canvas, Fase 6 dashboard) | Fases 1, 3, 5, 6 — antes de codificar cada uma | nenhuma | Baixo — só leitura, devolve plano em texto |
| `fork` (subagent) | ferramenta `Agent`, `subagent_type: "fork"` | Pesquisa ou implementação paralela sem poluir o contexto principal (herda a conversa inteira) | Qualquer fase com sub-tarefas independentes (ex: escrever 2 componentes que não dependem um do outro) | nenhuma além de já estar numa conversa longa o suficiente pra valer a pena | Baixo |
| Plugins de marketplace (`frontend-design`, `code-review`, `playwright`, `pr-review-toolkit`, etc. — catálogo completo em `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/`) | Catálogo local, **nenhum instalado/habilitado** | **Nenhum uso autorizado nesta rodada** — `pluginUsage` no `~/.claude.json` confirma 0 instalações ativas além de um plugin interno nunca usado (`engineering@inline`, `usageCount: 0`) | Nenhuma, até decisão explícita | Precisariam de instalação explícita (`/plugin install`), fora do escopo da Fase 0 — a instrução deste prompt proíbe instalação em massa (`--all`) | Médio — instalar plugin novo é mudança de ambiente de desenvolvimento, não código do produto; decidir com você antes de fazer isso em qualquer fase futura |
| Skills "Ruflo" (`~/.claude/skills/ruflo` → symlink pra `~/.agents/skills/ruflo`, repositório externo completo com ~14 mil arquivos) | Symlink local, fora do repo VETOR | **Fora de escopo total** — são skills de *runtime* do próprio ecossistema de agentes (framework externo), não ferramentas de autoria do Claude Code. O VETOR já tem seu próprio catálogo de skills, corretamente dentro do repo em `apps/agentes/src/skills/`, com proveniência registrada (`source-manifest.json`) e carregamento seletivo por departamento (ver `apps/agentes/src/skills/README.md`) | Nenhuma | N/A | Alto se confundido com skill de autoria — nunca instalar o pacote Ruflo inteiro no runtime dos agentes (regra já vigente no projeto, reafirmada nas restrições deste prompt: "Não instalar todos os skills do Ruflo no runtime") |

## Seleção por fase (aplicada a partir da Fase 1)

Uso a mesma lógica em toda fase futura: **primeiro localizar os arquivos reais** (Explore), **depois
planejar** (Plan, só quando a fase for grande o suficiente pra justificar), **implementar direto**
(sem skill dedicada de "geração de UI" — não há nenhuma instalada), e **revisar segurança**
(`security-review`) antes de fechar qualquer fase que toque RLS, upload ou URLs assinadas.

Nenhuma skill de UI/UX, design system, Meta Ads, analytics, canvas/React Flow ou vídeo está
instalada neste ambiente hoje. Onde o prompt pede essas skills especializadas (Fases 1, 3, 4, 6, 7),
o trabalho será feito com julgamento direto de engenharia + revisão manual comparando contra a
referência estrutural pedida, documentando isso explicitamente no relatório de cada fase — nunca
fingindo ter usado uma skill que não existe neste ambiente.
