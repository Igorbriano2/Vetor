# Rotina recorrente de marketing

Adaptado de `marketing-loops` (coreyhaines31/marketingskills, MIT) — o original assume um agente
CLI que se auto-agenda num crontab. O VETOR **não tem hoje** um mecanismo de missão recorrente
automática — esta skill produz a *definição* da rotina (o que checar, com que cadência, o que fazer
quando encontra algo, quando escalar pra aprovação humana); acionar de fato ainda depende do
cliente pedir de novo ou de uma missão recorrente ser implementada no Orchestrator (gap conhecido,
não fingir que já existe agendamento automático).

## Quando usar

Cliente quer algo verificado com regularidade (não uma tarefa única) — ex: "toda sexta me diga como
foram os pedidos da semana", "avisa se uma campanha começar a performar mal".

## As 9 partes de uma rotina bem definida (adaptado do catálogo original)

Ao desenhar uma rotina, preencha todas — uma rotina sem critério de parada ou sem o que fazer no
"nada mudou" é raso demais pra ser útil:

1. **Cadência de checagem** — combine com a velocidade real do sinal (tráfego pago muda em dias,
   ranking/posicionamento muda em semanas — não cheque tráfego pago 1x/mês nem posicionamento
   1x/dia).
2. **Condição de ação** — o que precisa ser verdade pra *fazer* algo, não só checar (a maioria das
   execuções de uma boa rotina é "chequei, nada a fazer").
3. **Propósito** — o resultado único que essa rotina protege ou melhora.
4. **Skills/agentes envolvidos** — quais dessa lista a rotina aciona a cada execução.
5. **Passos da rotina** — sequência ordenada.
6. **Autochecagem** — verificação antes de agir (não reagir a ruído/sazonalidade).
7. **Estado** — o que a rotina precisa lembrar entre execuções (última vez que rodou, o que já foi
   avisado) pra não repetir aviso.
8. **Parada/escalonamento** — quando pausa sozinha e quando chama um humano.
9. **Saída** — onde o resultado aparece (relatório, aprovação pendente, notificação).

## Saída

`criar_briefing` com a rotina definida nas 9 partes acima. Deixe explícito no `summary` que a
execução automática recorrente ainda depende de acionamento manual — nunca declare que a rotina
"já está rodando sozinha".
