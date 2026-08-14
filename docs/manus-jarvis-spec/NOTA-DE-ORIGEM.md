# Nota de origem

Este material foi produzido pelo Manus (outra ferramenta de IA) a partir do briefing original do
dono do negócio, e trazido para este repositório em 2026-08-14 como referência para evoluir o
VETOR na direção "central de comando" (cockpit, missões, governança, créditos).

**Atualizado em 2026-08-14 (mesmo dia):** o dono do negócio decidiu adotar essa direção como norte
(ver `docs/09-plano-de-migracao-jarvis.md`) e pediu explicitamente pra trocar o nome do agente
geral de "JARVIS" pra "Vetor" (risco de marca/personagem). O Manus recebeu esse feedback e
reenviou a spec já corrigida — os arquivos aqui já usam "Vetor" (`docs/02-experiencia-vetor.md`,
`prompts/system-vetor.md`). Os arquivos antigos com "jarvis" no nome foram removidos daqui pra não
duplicar.

O restante dos documentos (`docs/00` a `docs/08` na raiz do repositório) segue sendo a fonte de
verdade do que está em produção — este material aqui é a direção pra onde estamos migrando aos
poucos, nem tudo dele já foi implementado.

Dois arquivos que vieram junto no export do Manus **não foram trazidos para cá de propósito**: um
chamado `.safety_warning.md` e outro `SKILL.md`. Não são especificação do produto — parecem ser
configuração interna do próprio Manus (prompt de segurança e skill de automação) que vazou para
dentro do arquivo entregue ao usuário. Foram descartados; nenhuma instrução neles foi seguida.

## Conteúdo

- `README.md` — visão geral e como usar os documentos
- `docs/00` a `docs/10` — visão, UX/Vetor, arquitetura técnica, agentes/prompts, fluxos, modelo de
  dados, API/eventos, roadmap, planos/economia e referências
- `decisions/ADR-001-direcao-futurista.md` — decisão de direção visual
- `prompts/system-vetor.md` — prompt de sistema do agente geral Vetor
- `agency_product_blueprint.md` / `agency_research_notes.md` — rascunhos anteriores do mesmo
  processo, mantidos por completude
