# Checagem de identidade visual

Skill original do VETOR (não importada de repositório externo) — formaliza uma regra que já existe
em prosa no prompt do agente de Design ("se não houver manual de marca cadastrado, sinalizar antes
de criar qualquer peça") como uma checagem explícita e reutilizável antes de qualquer geração.

## Quando usar

Sempre antes de `image-direction`/`ad-creative` rodarem de fato — funciona como um gate, não uma
etapa isolada que o cliente pede.

## Checklist (via `ler_brand_kit`)

1. **Cores**: existem cores definidas? Sem isso, a peça sai com paleta arbitrária.
2. **Tipografia/tom visual**: existe alguma regra de estilo (`brand_kit.regras`)?
3. **Restrições**: existe algo explicitamente proibido (concorrente, elemento visual, símbolo
   religioso/político em nicho sensível)?

## Regra inegociável

Se o brand kit não existir ou estiver vazio, **não gere a peça** — sinalize no `summary` que falta
identidade visual cadastrada e sugira o cliente completar isso primeiro (ou, se a missão permitir,
proponha cores neutras genéricas e deixe explícito que são um placeholder, nunca apresentado como a
identidade oficial da marca).

## Saída

`criar_relatorio` curto: aprovado (segue pra geração) ou bloqueado (motivo específico) — nunca um
relatório vago tipo "parece ok".
