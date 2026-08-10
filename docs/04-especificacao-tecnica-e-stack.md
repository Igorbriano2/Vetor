# 04 — Especificação Técnica e Stack (para Claude Code)

> Você (dono do negócio) não precisa entender cada item deste documento em profundidade. Ele existe
> para o Claude Code ter clareza de decisão técnica e para você conseguir conversar com qualquer
> desenvolvedor/consultor no futuro sem depender de tradução. Os pontos marcados como "decisão de
> negócio" são os únicos que precisam da sua palavra final.

## 1. Visão de arquitetura

```
Cliente (WhatsApp / Painel Web)
        │
        ▼
Agente Secretário  ──► Agente Geral (Orquestrador)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                      ▼
  Growth / Estratégia   Tráfego / Design /      Agente Analítico
                         Social Media / Vídeo
        │                     │                      │
        └─────────────────────┴──────────────────────┘
                              ▼
                    Painel do Cliente (Dashboard)
                              │
                              ▼
                 Cobrança (Asaas) + Notificações
```

## 2. Stack recomendada

| Camada | Recomendação | Por quê |
|---|---|---|
| Orquestração de agentes | **LangGraph** (Python) ou **CrewAI** | LangGraph dá mais controle sobre fluxos com dependência entre agentes (mais alinhado à hierarquia do documento 03). CrewAI é mais simples de começar. Para o MVP, CrewAI reduz tempo de construção; migrar para LangGraph depois é viável. |
| Modelos de LLM | Mix: um modelo mais robusto para Geral/Estratégia/Analítico, modelos mais leves e baratos para tarefas repetitivas (legendas, respostas de atendimento simples) | Controla custo — não faz sentido gastar o mesmo processamento para "gerar uma legenda" e para "decidir uma estratégia de campanha". |
| Backend/API | **Node.js (NestJS) ou Python (FastAPI)** | Ambos têm boas bibliotecas para integração com WhatsApp, Meta Ads API e Asaas. FastAPI se o time de agentes for todo em Python (mais comum em projetos de IA); NestJS se preferir unificar com o frontend em TypeScript. |
| Frontend (painel + landing page) | **Next.js (React) + Tailwind** | Permite landing page performática e painel autenticado no mesmo projeto, com deploy simples (Vercel). |
| Banco de dados | **PostgreSQL** (via Supabase, que já resolve auth, storage de arquivos e banco vetorial no mesmo lugar) | Supabase acelera muito o MVP: autenticação de cliente, upload de peças de design, e pgvector para a base de conhecimento (RAG) dos agentes, tudo integrado. |
| Banco vetorial (RAG) | **pgvector dentro do próprio Supabase** | Evita adicionar mais um serviço externo (Pinecone/Weaviate) na Fase 1 — só migrar se o volume de conhecimento crescer muito. |
| WhatsApp | **API oficial do WhatsApp Business (Meta Cloud API)** | Evita risco de bloqueio de número que soluções não-oficiais têm. Provedores como Twilio ou Z-API podem simplificar a implementação inicial por cima da API oficial. |
| Anúncios | **Marketing API do Meta** | Necessária para o Agente de Tráfego criar/gerenciar campanhas programaticamente. |
| Pagamentos/assinatura | **Asaas** como principal (ver documento 05 para o racional completo) | Resolve Pix, boleto, cartão e nota fiscal nativamente para negócio brasileiro cobrando de negócio brasileiro. |
| Geração de imagem | API de geração de imagem com licença comercial clara (avaliar opções no momento da implementação — o mercado muda rápido; peça ao Claude Code para pesquisar as opções vigentes antes de integrar) | Evitar ferramentas sem termos de uso comercial claros — risco para os clientes finais. |
| Geração/edição de vídeo | API de vídeo com avatar/motion (ex: ferramentas com licença comercial, a validar no momento da implementação) | Mesma ressalva acima. |

**Decisão de negócio necessária aqui:** aprovar o uso do Supabase como base (auth + banco + storage + vetor) simplifica MUITO o MVP e reduz custo de infraestrutura no início. Recomendo fortemente começar assim e só migrar para uma arquitetura mais distribuída se o volume justificar.

## 3. Modelagem inicial de dados (alto nível)

Tabelas essenciais para o MVP:

- `clientes` (empresa, nicho, plano contratado, status da assinatura, manual de marca)
- `usuarios` (contatos de cada cliente com acesso ao painel)
- `demandas` (ticket criado pelo Agente Secretário/Geral — status, tipo, histórico)
- `entregas` (peças/campanhas geradas, vinculadas a uma demanda, com status de aprovação)
- `campanhas_trafego` (dados sincronizados da Meta Ads API — métricas, orçamento, status)
- `conteudo_social` (calendário editorial, status de agendamento/publicação)
- `assinaturas` (dados de cobrança, sincronizados com o Asaas — ver documento 05)
- `relatorios` (saída consolidada do Agente Analítico por período)
- `log_agentes` (toda ação tomada por um agente, com justificativa — importante para auditoria e para melhorar os prompts com o tempo)

## 4. Ambiente de desenvolvimento

- Repositório único (monorepo) no início é mais simples de gerenciar sozinho com o Claude Code:
  `/apps/landing`, `/apps/painel`, `/apps/agentes`, `/packages/shared`.
- Ambientes: `desenvolvimento` (local), `homologação` (para testar com clientes beta antes do
  público geral) e `produção`.
- Variáveis sensíveis (chaves de API do Meta, Asaas, LLM) sempre em `.env`, nunca commitadas —
  peça ao Claude Code para configurar isso desde o primeiro commit.

## 5. Segurança e LGPD (não é opcional)

- Dados de clientes finais (leads capturados) e dados dos clientes-empresa devem ficar isolados por
  conta (multi-tenancy) — um cliente nunca pode ver dado de outro.
- Política de privacidade e termos de uso publicados desde o lançamento (exigência legal para
  cobrança recorrente e coleta de dados via formulário/WhatsApp).
- Direito de exportação e exclusão de dados a pedido do cliente (LGPD).
- Servidores preferencialmente com opção de região no Brasil (Supabase permite escolher a região do
  projeto).

## 6. O que NÃO construir no MVP (evitar over-engineering)

- Não construir orquestração multi-agente complexa com os 9 agentes rodando de forma totalmente
  autônoma desde o dia 1. Documento 06 detalha o "modo supervisionado" — comece com aprovação
  humana em pontos-chave e vá automatizando conforme ganha confiança nos resultados.
- Não construir app mobile nativo no início — painel web responsivo resolve.
- Não integrar Google Ads na Fase 1 — Meta Ads já cobre a maior demanda inicial do público-alvo.
