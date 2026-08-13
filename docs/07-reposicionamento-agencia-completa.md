# 07 — Reposicionamento: agência completa com 7 papéis de IA

> Este documento registra uma decisão de produto tomada depois do lançamento do MVP (docs 00-06),
> a pedido do dono do negócio. Os documentos 00-06 continuam sendo a base técnica; este documento
> só ajusta posicionamento e precificação por cima do que já existe.

## 1. A virada de chave

A ideia original (documento 00) já incluía 9 agentes, mas a comunicação (documento 02) agrupava
tudo em 4 blocos de valor abstratos. A decisão agora é comunicar de forma literal: uma agência de
marketing de verdade precisa de 7 papéis —

1. Designer
2. Estrategista
3. Social Media
4. Editor de Vídeo
5. Copywriter / Redator
6. Gestor de Tráfego
7. Atendente

— e no Vetor, **todos os 7 são agentes de IA**, disponíveis dentro de uma ferramenta só, com
painel de solicitação e dashboard incluídos (sem precisar contratar, treinar ou gerenciar ninguém
disso separadamente).

## 2. Por que mostrar o custo de montar isso sozinho

Comparar preço de plano contra preço de plano (Vetor vs. "agência tradicional genérica") é menos
convincente do que mostrar o custo de **montar a própria equipe** — é o que o público-alvo (donos
de pequenos negócios) realmente comparam mentalmente antes de decidir gerenciar isso por conta
própria.

### Estimativas de mercado usadas (Brasil, contratação parcial/freelancer para um negócio pequeno)

Estes são valores médios de mercado, não uma pesquisa formal — devem ser tratados como estimativa
e revisados se o dono do negócio tiver dados melhores:

| Papel | Custo mensal estimado |
|---|---|
| Designer (freelancer, dedicação parcial) | R$ 1.800 |
| Estrategista de marketing | R$ 2.000 |
| Social Media | R$ 1.500 |
| Editor de vídeo | R$ 1.500 |
| Copywriter / Redator | R$ 1.200 |
| Gestor de tráfego (fee de gestão, sem contar verba de mídia) | R$ 1.800 |
| Atendente (meio período / CLT com encargos) | R$ 2.200 |
| Ferramentas (design, agendamento, CRM, dashboard) | R$ 400 |
| **Total estimado** | **≈ R$ 12.400/mês** |

Isso **não inclui** a verba de mídia paga aos anúncios (Meta/Google) — essa parte é paga direto à
plataforma de anúncios em qualquer cenário (agência própria, agência terceirizada ou Vetor) e não
entra na comparação de "custo de operação".

## 3. Novo plano principal: Completo — R$ 1.997/mês

Reposicionado como o plano recomendado (não mais um dos cinco planos "iguais"), com economia de
aproximadamente 84% frente ao custo estimado de montar a equipe (seção 2), mantendo qualidade e
velocidade — não pela promessa de "pensar melhor", mas por eliminar contratação, turnover, férias,
13º, treinamento e gestão de pessoas (consistente com o que o documento 01 autoriza prometer:
consistência, velocidade, disponibilidade 24h, método).

Inclui:
- Design: 25 peças por mês (feed, story, anúncios, materiais)
- Social Media: calendário editorial completo + 30 publicações/mês
- Copywriter: textos e legendas de todo o conteúdo do plano, sem cobrança à parte
- Vídeo: 6 vídeos editados por mês
- Estratégia: revisão de posicionamento e funil mensal (upgrade frente ao trimestral anterior)
- Tráfego: gestão completa de campanhas Meta Ads, até R$ 5.000/mês de verba gerida sem custo
  adicional de gestão — acima disso, 5% sobre o excedente investido (a verba em si sempre vai
  direto para o Meta, nunca passa pelo Vetor)
- Atendimento 24h via WhatsApp, incluindo áudio (ver seção 4)
- Analítico: relatórios semanais + dashboard em tempo real
- Painel único de solicitação, aprovação e histórico

Excedente (mesma lógica de cota + excedente do doc 05): peça de design extra R$ 25, publicação
extra R$ 18, vídeo extra R$ 150 — taxas menores que nos planos de entrada porque é o plano de
maior volume.

Os planos menores (Design, Social Media, Dupla de Agentes, Tráfego) continuam existindo como porta
de entrada para quem ainda não precisa do pacote completo.

## 4. Atendimento por áudio ("parecer do futuro")

Pedido explícito: o atendimento via WhatsApp deve parecer inteligente e natural ao ponto de o
contratante sentir que está falando com alguém que realmente entende — incluindo mandar áudio em
vez de texto.

Implementação (ver `apps/agentes`):
- O Agente Secretário passa a reconhecer mensagens de áudio recebidas pelo WhatsApp (Meta Cloud
  API já entrega o `media id` do áudio no webhook).
- O sistema baixa o áudio e transcreve via um provedor de transcrição de voz plugável (a decisão de
  qual provedor usar em produção é uma decisão de negócio — ver `.env.example`, `STT_PROVIDER`).
  Isso não está ligado a nenhuma conta paga ainda; é a mesma lógica de "sandbox até ter credencial
  real" usada no resto do projeto.
- A transcrição entra na mesma pipeline de ticket estruturado já existente (nenhuma lógica nova de
  negócio — só um novo formato de entrada).

**Isso não é uma promessa de IA "sobre-humana"** — é uma melhoria de UX (aceitar áudio, responder
rápido, manter contexto). O tom de voz continua seguindo as regras do documento 01: nada de
"revolucionário"/"disruptivo", só exemplos concretos do que a pessoa vai sentir na prática.
