# Pesquisa de cliente

Adaptado de `customer-research` (coreyhaines31/marketingskills, MIT) — cortados os modos de
pesquisa que dependem de fonte externa que o VETOR não acessa hoje (Reddit/G2/fóruns); mantido só
o Modo 1 (analisar material que já existe), que é o único que o VETOR consegue fazer com dado real
sem inventar.

## Quando usar

Pedido de persona/pesquisa de cliente, ou como insumo pra `content-strategy`/`offers` quando falta
entender melhor quem compra.

## Regra central: nunca fabricar persona

O VETOR não tem acesso a entrevista/pesquisa formal do cliente na maioria dos casos — o material
real disponível é: histórico de conversa com o próprio cliente (`ler_historico`), e o que está no
perfil de negócio. Se isso não for suficiente pra uma seção, **diga explicitamente "não há dado
suficiente"** em vez de inventar uma persona genérica de mercado.

## Framework de extração (quando há material real)

Para cada fonte disponível, extraia:
- **Dor/gatilho**: o que fez a pessoa procurar isso agora, não antes.
- **Linguagem literal**: como ela descreve o problema com as próprias palavras — prefira citação a
  paráfrase.
- **Objeção**: o que quase impediu a decisão.
- **Alternativa considerada**: o que ela tentou/pensou em usar antes.

## Workflow

1. Confirme com o texto da etapa se existe material real disponível (histórico de conversa,
   feedback já registrado) — se não existir, o output vira uma lista de *perguntas que a agência
   deveria fazer ao cliente*, não uma persona fabricada.
2. Se existir, extraia pelo framework acima.
3. Separe fato (dito literalmente) de inferência (você concluiu) — nunca misture os dois sem
   rotular.

## Saída

`criar_relatorio` com achados rotulados fato/inferência. Se algo for reutilizável em decisões
futuras (ex: "clientes reclamam do tempo de entrega"), registre com `salvar_hipotese` e confiança
compatível com a força da evidência.
