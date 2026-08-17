# Skill Registry do VETOR

Skills são instruções e workflows reutilizáveis por departamento — **nunca** substituem agentes,
tools, MCPs, workers ou o runtime do VETOR (Mission Orchestrator, Policy Engine, Tool Registry,
fila/worker continuam sendo a única forma de algo realmente acontecer). Uma skill só orienta *como*
um especialista já existente conduz uma etapa; ela nunca chama nada fora do Tool Registry.

## Estrutura

```
skills/
  types.ts               SkillDefinition, SkillManifest, SkillContext, SkillRun, SkillEvaluation
  registry.ts             descoberta + seleção por trigger + carregamento progressivo
  loader.ts                leitura de manifest.json / SKILL.md / references/
  permissions.ts           valida allowedTools contra o Tool Registry real (fail-closed)
  source-manifest.json     proveniência: repo, commit, licença, versão, data de importação
  skills/{id}/
    manifest.json           SkillManifest sem o campo `source` (vem de source-manifest.json)
    SKILL.md                instruções da skill, só lidas quando selecionada
    references/             scripts/exemplos/rubricas, lidos só sob demanda
  playbooks/                workflows menores versionados, compostos por 2+ skills
  evals/                    casos de avaliação por skill (Fase 7)
```

## Carregamento progressivo (princípio 8)

1. `registry.ts` lê só os `manifest.json` de todas as skills (pequenos, cabem juntos no prompt de
   seleção do Vetor/especialista).
2. `selecionarSkills(department, textoDaEtapa)` casa triggers contra o texto da etapa — seleção
   simples e auditável, nunca um classificador opaco.
3. Só depois de selecionada, `carregarSkillsSelecionadas(ids)` lê o `SKILL.md` completo. Referências
   (`references/`) só são lidas se a própria skill pedir durante a execução.

## Import de uma skill nova

1. Confirme a licença do repositório de origem (`gh api repos/{owner}/{repo} --jq .license.spdx_id`
   ou a API pública do GitHub). Só MIT/Apache-2.0/BSD e afins — **nunca** copie de um repo sem
   licença clara ou AGPL sem análise jurídica prévia.
2. Adapte o conteúdo ao vocabulário/ferramentas do VETOR — nunca cole prompt/código cru: troque
   nomes de ferramenta pelos reais do Tool Registry (`apps/agentes/src/tools/registry.ts`), remova
   qualquer chamada direta a provider (a skill nunca conhece OpenAI/Higgsfield/Meta por nome — só o
   nome da tool do gateway).
3. Crie `skills/{id}/manifest.json` (schema em `types.ts::SkillManifest`, sem o campo `source`) e
   `skills/{id}/SKILL.md`.
4. Adicione uma entrada em `source-manifest.json`:
   ```json
   {
     "id-da-skill": {
       "repository": "owner/repo",
       "commit": "sha completo do commit consultado",
       "license": "MIT",
       "importedAt": "2026-08-17T00:00:00Z"
     }
   }
   ```
5. Rode `permissions.ts::validarPermissoesDaSkill` (via teste) — uma skill com `allowedTools` fora
   do Tool Registry, ou com `riskLevel`/`requiresApproval` subdeclarado em relação ao risco real das
   ferramentas usadas, nunca fica visível pro registry (fail-closed, mesmo padrão de
   `tools/registry.ts::buscarFerramenta`).

## Repositórios avaliados (Fase 0)

| Repo | Licença | Uso pretendido |
|---|---|---|
| coreyhaines31/marketingskills | MIT | base pras skills de Estratégia/Growth |
| samuraigpt/generative-media-skills | MIT | padrões de briefing/prompt versionado pra Design/Vídeo |
| FireRedTeam/FireRed-OpenStoryline | Apache-2.0 | referência de workflow pro Videomaker (Style Skills) |
| KyaniteLabs/kinocut | Apache-2.0 | referência de superfície de edição determinística |
| irinabuht12-oss/google-meta-ads-ga4-mcp | MIT | padrão de ferramentas read-only de Tráfego/Analytics |
| alirezarezvani/claude-skills | MIT | referência de estrutura de manifest/SKILL.md |
| VoltAgent/awesome-agent-skills | MIT | lista curada — só linkagem/pesquisa, sem código a copiar |
| stevenflanagan1/social-ai-team | **sem licença** | só referência arquitetural — nunca copiar arquivo |
| ComposioHQ/awesome-claude-skills | **sem licença** | só referência — nunca copiar arquivo |

`Multi-Agent-Marketing-Course` (AGPL, mencionado no pedido original) não está na lista acima e não
deve ser incorporado sem análise jurídica prévia.
