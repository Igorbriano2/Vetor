# 06 — Plano de Execução: Comandos Prontos para o Claude Code

> Cole um bloco de cada vez no Claude Code, na ordem abaixo. Espere cada etapa terminar, revise o
> que foi construído (peça para ele explicar em português simples se precisar) antes de colar o
> próximo bloco. Os documentos 01 a 05 devem estar salvos na pasta do projeto (ex: `/docs/`) para o
> Claude Code poder referenciá-los.

---

## Fase 0 — Preparação do projeto

**Comando 0.1 — Iniciar o projeto**
```
Vamos criar um novo projeto chamado "vetor" (agência de marketing operada por agentes de IA).
Leia os documentos da pasta /docs/ (00 a 05) antes de qualquer coisa e me faça um resumo de 5
linhas confirmando que entendeu o objetivo do produto, o público-alvo e a stack recomendada no
documento 04. Depois, crie a estrutura de monorepo sugerida no documento 04, seção 4, com as
pastas /apps/landing, /apps/painel, /apps/agentes e /packages/shared, cada uma com um
README.md explicando o propósito da pasta.
```

**Comando 0.2 — Configurar ambiente base**
```
Configure o projeto com Next.js + Tailwind para /apps/landing e /apps/painel, conforme a stack do
documento 04. Configure um projeto Supabase (posso criar a conta e te passar as chaves, ou me
explique o passo a passo para eu mesmo criar). Crie o arquivo .env.example com todas as variáveis
necessárias (Supabase, Meta API, Asaas, provedor de LLM) SEM valores reais. Configure controle de
versão com git e um .gitignore adequado para não commitar nada sensível.
```

---

## Fase 1 — MVP (landing page + atendimento básico + cobrança)

**Comando 1.1 — Landing page**
```
Usando o documento 02 (especificação da landing page) e o documento 01 (identidade de marca), crie
a landing page completa em /apps/landing. Siga a estrutura de seções do documento 02 na ordem
descrita. Use as cores e tipografia do documento 01. Gere uma copy inicial em português-BR seguindo
o tom de voz descrito — eu vou revisar o texto antes de publicar. Ao final, me mostre como rodar o
projeto localmente para eu ver o resultado.
```

**Comando 1.2 — Modelagem de dados inicial**
```
Usando o documento 04, seção 3, crie as tabelas do Supabase para: clientes, usuarios, demandas,
entregas, assinaturas e log_agentes. Aplique isolamento por conta (row level security) desde o
início, para que um cliente nunca acesse dado de outro. Me explique em linguagem simples o que foi
criado.
```

**Comando 1.3 — Agente Secretário (atendimento via WhatsApp)**
```
Usando o system prompt do Agente Secretário no documento 03, implemente a integração com a API
oficial do WhatsApp Business (Meta Cloud API) em /apps/agentes. O agente deve: receber mensagens,
qualificar o lead ou identificar o cliente existente, e salvar o ticket estruturado na tabela
"demandas". Nesta fase, ainda NÃO conecte a outros agentes — apenas registre a demanda e me avise
(por enquanto, um humano vai olhar e decidir o que fazer com cada demanda recebida). Configure um
ambiente de teste (sandbox do WhatsApp) antes de qualquer número real.
```

**Comando 1.4 — Painel simples do cliente**
```
Crie em /apps/painel uma tela de login (usando auth do Supabase) e um painel simples que mostra ao
cliente: suas demandas abertas, status de cada uma, e histórico de entregas. Ainda não precisa ter
todas as funcionalidades — o objetivo aqui é o cliente ter visibilidade básica do que está
acontecendo.
```

**Comando 1.5 — Cobrança via Asaas**
```
Usando o documento 05, integre a criação de cliente e assinatura recorrente via API do Asaas
(comece em modo sandbox). Implemente o endpoint de recebimento de webhooks (PAYMENT_CONFIRMED,
PAYMENT_OVERDUE, SUBSCRIPTION_CANCELED) e conecte ao status da tabela "assinaturas". Ainda não
implemente a cobrança variável por excedente — só a mensalidade fixa dos planos "1 Agente" e
"Dupla de Agentes" por enquanto.
```

**Checkpoint da Fase 1:** ao final desta fase, vocês devem conseguir: captar lead pela landing
página, um cliente pagante ser cadastrado e cobrado via Asaas, e uma demanda chegando pelo WhatsApp
ser registrada no sistema — mesmo que ainda resolvida manualmente por um humano da equipe. **Isso
já é suficiente para rodar um piloto real com 2-3 clientes beta antes de automatizar mais.**

---

## Fase 2 — Orquestração e primeiros agentes de execução

**Comando 2.1 — Orquestrador (Agente Geral)**
```
Usando o system prompt do Agente Geral no documento 03 e a stack de orquestração definida no
documento 04 (CrewAI para começar), implemente o Agente Geral em /apps/agentes. Ele deve ler
demandas da tabela "demandas" com status "novo", decompor em tarefas, e por enquanto direcionar
apenas para os Agentes de Design e Tráfego (os dois primeiros agentes de execução que vamos
construir). Registre toda decisão na tabela "log_agentes" com a justificativa, conforme o
documento 03 pede.
```

**Comando 2.2 — Agente de Design**
```
Implemente o Agente de Design usando o system prompt do documento 03. Nesta fase inicial, ele deve
gerar peças estáticas (feed e story) a partir do manual de marca cadastrado do cliente (crie também
a tela no painel para o cliente cadastrar seu manual de marca: cores, logotipo, tom visual).
Pesquise e me apresente 2-3 opções de API de geração de imagem com licença comercial clara antes de
integrar qualquer uma — não escolha sozinho, me traga as opções e eu decido.
```

**Comando 2.3 — Agente de Tráfego (modo supervisionado)**
```
Implemente o Agente de Tráfego usando o system prompt do documento 03, com a Marketing API do Meta.
IMPORTANTE: respeite os limites de autonomia descritos no prompt — ele pode PAUSAR campanhas
automaticamente quando o custo por resultado ultrapassar o teto definido, mas NUNCA pode aumentar
orçamento sozinho nos primeiros 90 dias. Toda ação deve ficar registrada em log_agentes.
```

**Comando 2.4 — Aprovação no painel**
```
Adicione ao painel do cliente uma tela de aprovação: peças de Design e alterações de campanha de
Tráfego ficam pendentes até o cliente (ou um humano da equipe, se o cliente preferir) aprovar.
```

**Checkpoint da Fase 2:** demanda de design e campanha de tráfego já fluem com orquestração
automática, mas sempre com um ponto de aprovação humana antes de ir ao ar.

---

## Fase 3 — Social Media, Estratégia e Analítico

**Comando 3.1**
```
Implemente o Agente de Estratégia e o Agente de Growth usando os prompts do documento 03. Eles
devem ser acionados pelo Agente Geral quando uma demanda envolver planejamento de campanha (não
apenas execução pontual). Inclua as regras de compliance por nicho descritas no prompt do Agente de
Estratégia — isso é obrigatório antes de liberar qualquer peça para clientes de saúde e advocacia.
```

**Comando 3.2**
```
Implemente o Agente de Social Media usando o prompt do documento 03: geração de calendário
editorial, legendas e agendamento. Conecte com as contas de Instagram/Facebook do cliente (via API
oficial da Meta). Mantenha o modo supervisionado (aprovação antes de publicar) por padrão, com opção
de o cliente ativar publicação automática depois de alguns ciclos.
```

**Comando 3.3**
```
Implemente o Agente Analítico usando o prompt do documento 03. Ele deve consolidar métricas de
Tráfego e Social Media (e dados do CRM/demandas) em relatórios semanais e mensais, visíveis no
painel do cliente, com recomendações acionáveis enviadas de volta ao Agente Geral.
```

---

## Fase 4 — Expansão

**Comando 4.1**
```
Implemente o Agente de Edição de Vídeo usando o prompt do documento 03. Antes de integrar qualquer
API de edição/geração de vídeo, pesquise e me apresente opções com licença comercial válida.
```

**Comando 4.2 — Base de conhecimento (RAG)**
```
Configure o pgvector no Supabase (conforme documento 04) e crie o processo de ingestão de
documentos/frameworks de marketing para alimentar a base de conhecimento de cada agente,
especialmente Estratégia, Growth e Tráfego. Use apenas material com direito de uso claro (resumos e
frameworks próprios, não texto integral de livros protegidos).
```

**Comando 4.3 — Cobrança variável e % sobre mídia**
```
Usando o documento 05, implemente a cobrança de excedente de créditos/execuções e o cálculo de %
sobre verba de mídia para clientes do plano de Tráfego, com base nos dados reais sincronizados da
Marketing API do Meta.
```

---

## Regras gerais para todos os comandos acima

- Sempre peça ao Claude Code para **explicar em português simples** o que foi feito ao final de
  cada bloco — você precisa entender o suficiente para tomar decisão de negócio, não para
  programar.
- Nunca aprove integração com dinheiro real (Asaas, Meta Ads) sem antes testar em modo sandbox.
- A cada fase concluída, rode com clientes beta reais antes de avançar para a próxima — isso vale
  mais que qualquer estimativa de prazo.
