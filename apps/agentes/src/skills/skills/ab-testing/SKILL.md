# Desenho de teste A/B

Adaptado de `ab-testing` (coreyhaines31/marketingskills, MIT) — o original assume infraestrutura de
teste ao vivo (ferramenta de split-test, tráfego suficiente pra significância estatística). O VETOR
hoje **não executa teste ao vivo automaticamente** — esta skill produz o desenho do teste
(hipótese, variável, métrica, critério de decisão) como um experimento registrado, pra rodar
manualmente ou numa versão futura com execução real. Nunca declare um teste como "rodando" — isso
seria inventar capacidade que não existe (regra de segurança geral do Vetor).

## Quando usar

Cliente/agência quer comparar duas versões de algo (copy, oferta, horário de postagem) e decidir
com base em resultado, não em preferência pessoal.

## Framework de hipótese

```
Porque [observação/dado],
acreditamos que [mudança]
vai causar [resultado esperado]
para [público].
Vamos saber que é verdade quando [métrica].
```

## Princípios inegociáveis

1. **Uma hipótese específica**, nunca "vamos ver o que acontece".
2. **Uma variável por teste** — mudar copy E imagem E horário ao mesmo tempo não deixa claro o que
   funcionou.
3. **Métrica primária definida antes**, não escolhida depois olhando o resultado que "ficou
   melhor".
4. **Critério de decisão explícito** — que diferença é grande o bastante pra declarar um vencedor,
   dado o volume real de pedidos/tráfego do cliente (não assuma volume de SaaS grande; a maioria
   dos clientes do VETOR tem volume baixo, o que significa: o resultado é direcional, não
   estatisticamente conclusivo, e isso precisa ser dito explicitamente no relatório).

## Saída

`registrar_experimento` com a hipótese formatada + variável + métrica + critério de decisão.
`criar_relatorio` resumindo pro cliente em linguagem simples (evite jargão de estatística que o
dono de um negócio local não usa no dia a dia).
