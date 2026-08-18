# Análise de experimento

Skill original do VETOR (não importada de repositório externo).

## Quando usar

A missão tem uma hipótese (`missaoHipotese`) e um critério de sucesso relacionado a tráfego pago, e
a etapa pede avaliar se o experimento confirmou ou não a hipótese.

## O que fazer

1. Releia a hipótese e o critério de sucesso da missão.
2. Confira, no bloco "TRÁFEGO", se as campanhas reais relacionadas ao experimento têm dado
   suficiente sincronizado pra julgar o critério (ex: se o critério é "CTR acima de X%", o campo
   `ctr` precisa estar presente e vir de mais de um dia de dado, não de uma sincronização isolada).
3. Julgue com uma das três respostas honestas:
   - **Confirmada**: o dado real bate com o critério definido — cite o número exato.
   - **Refutada**: o dado real não bate — cite o número exato.
   - **Inconclusiva**: dado insuficiente ou ausente pra julgar — nunca force uma conclusão pra
     "fechar" o experimento sem base.
4. Registre o resultado via `registrar_experimento` pra virar memória operacional reutilizável em
   missões futuras (evita repetir o mesmo teste sem saber que já foi feito).

## Saída

Veredito do experimento (confirmada/refutada/inconclusiva) com o número real que sustenta a
conclusão, e o registro do experimento na memória operacional.
