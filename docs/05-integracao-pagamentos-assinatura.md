# 05 — Integração de Pagamentos e Modelo de Assinatura

## 1. Asaas vs. Stripe — decisão

| Critério | Asaas | Stripe |
|---|---|---|
| Pix | Nativo, self-service, é o core do produto | Para empresas sediadas no Brasil, hoje o Pix é liberado apenas por convite (não é self-service) — trava real para lançar rápido |
| Boleto | Nativo | Não é foco da Stripe no Brasil |
| Nota fiscal | Emite nota fiscal integrada em vários planos | Não emite nota fiscal brasileira — precisaria de serviço à parte |
| Split de pagamento | Nativo (útil se no futuro vocês tiverem parceiros/afiliados recebendo comissão) | Precisa do Stripe Connect, mais complexo de configurar para o cenário brasileiro |
| Cobrança recorrente (assinatura) | Nativo, com CPF/CNPJ, cartão, Pix e boleto recorrente | Nativo, mas otimizado para cartão internacional |
| Documentação/DX para o Claude Code | Boa, API REST simples | Excelente, é o padrão-ouro do mercado — mas o ganho não compensa a limitação do Pix |
| Cenário internacional | Não é o foco | Melhor opção se um dia vocês cobrarem clientes fora do Brasil |

**Decisão recomendada: Asaas como meio de pagamento principal.** Todo o público-alvo de vocês
(restaurantes, advogados, arquitetos, saúde, estética) é brasileiro, paga em real, e Pix é o método
de pagamento mais natural para esse perfil de cliente. Manter Stripe como opção **futura**, só se
surgir demanda de cliente internacional — não é prioridade de construção agora.

## 2. Modelo de cobrança — estrutura técnica

Baseado na estrutura de precificação já definida (documento anterior da conversa: fixo + variável
por consumo/execuções + % sobre verba de mídia no plano de Tráfego):

### Componentes a implementar no Asaas
1. **Assinatura fixa mensal** por plano contratado — usar o recurso de "cobranças recorrentes" do
   Asaas, vinculado ao plano do cliente na tabela `assinaturas`.
2. **Cobrança variável por excedente de créditos/execuções** — quando o cliente ultrapassar o
   limite do plano, gerar uma cobrança avulsa (Pix ou cartão) pelo pacote extra.
3. **% sobre verba de mídia (plano de Tráfego)** — não é cobrado pelo Asaas diretamente (a verba de
   anúncio vai direto para o Meta); o sistema precisa calcular esse valor com base no gasto real
   sincronizado da Marketing API do Meta e gerar uma cobrança adicional mensal referente à taxa de
   gestão.

### Webhooks necessários
- `PAYMENT_CONFIRMED` — libera/mantém acesso do cliente ao painel
- `PAYMENT_OVERDUE` — dispara lembrete automático (via WhatsApp, pelo próprio Agente Secretário) e,
  após X dias, suspende acesso
- `SUBSCRIPTION_CANCELED` — encerra acesso e dispara fluxo de retenção/feedback (pode ser humano no
  início, automatizado depois)

## 3. Controle interno de custo de token (crítico)

Antes de cobrar por "créditos/execuções", é necessário que o sistema registre, por cliente e por
demanda, o custo real de tokens consumidos por cada agente (ligado à tabela `log_agentes` do
documento 04). Isso não aparece para o cliente final — é um dashboard interno para garantir que a
margem entre o preço cobrado e o custo real de IA está sendo respeitada.

**Ação recomendada antes de fechar o preço final dos planos:** rodar o sistema em modo de teste com
3-5 clientes beta por 30 dias, medir o custo médio de token por tipo de entrega (1 campanha, 1 lote
de posts, 1 relatório), e só então validar se a tabela de preços sugerida no documento anterior
sustenta a margem desejada.

## 4. Fluxo de contratação (visão do cliente)

1. Cliente escolhe o plano na landing page ou fecha via WhatsApp com um humano/Agente Secretário.
2. Sistema cria o cliente no Asaas e gera a primeira cobrança (Pix ou cartão recorrente).
3. Após confirmação de pagamento, o painel do cliente é liberado e o onboarding começa (cadastro de
   manual de marca, serviços, WhatsApp do cliente conectado se aplicável).
4. Cobranças seguintes são automáticas; falha de pagamento aciona o fluxo de cobrança/suspensão
   acima.

## 5. O que pedir ao Claude Code, na prática

- Criar conta sandbox no Asaas para desenvolvimento antes de qualquer integração com dinheiro real.
- Implementar a criação de cliente e assinatura via API do Asaas, vinculada à tabela `assinaturas`.
- Implementar o endpoint de recebimento de webhooks do Asaas com validação de autenticidade.
- Implementar o cálculo de excedente de créditos e geração de cobrança avulsa.
- Deixar a integração de % sobre verba de mídia para a Fase 2 (depende do Agente de Tráfego já
  estar sincronizando dados reais da Marketing API do Meta) — não é bloqueante para o lançamento do
  MVP, que pode começar só com os planos fixos (Design, Social Media, plano Duplo).
