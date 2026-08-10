# 02 — Especificação da Landing Page (para Claude Code)

> Este documento é o briefing completo. Pode ser colado diretamente numa conversa com o Claude Code, junto com o documento 01 (identidade visual), para gerar a landing page.

## Referência de estrutura

A referência (octosolve.com.br) funciona porque conta uma **jornada narrada no tempo** ("22:47 sua mensagem chegou → 08:00 sua agenda está cheia") em vez de só listar features. Vamos usar a mesma lógica, adaptada para agência de marketing: a jornada de uma campanha/demanda do cliente, do pedido no WhatsApp até o relatório de resultado.

---

## Seções da página (em ordem)

### 1. Hero (acima da dobra)
- Headline no formato "problema real → resolução imediata", exemplo de direção (ajustar tom conforme documento 01):
  - *"Sua agência atual demora 3 dias para responder. A sua nova agência responde em 3 segundos — e nunca dorme."*
- Subheadline: uma frase explicando o que é (time de agentes de IA especializados: tráfego, design, social media, estratégia) supervisionado por especialistas.
- CTA primário: "Quero conhecer o Vetor" (ou "Testar grátis" / "Falar no WhatsApp" — decidir modelo de conversão no doc 06, fase 1)
- Micro-provas de confiança abaixo do CTA: "Sem fidelidade", "Setup em minutos", "Cancele quando quiser"
- Elemento visual: simulação de conversa de WhatsApp reagindo em tempo real (como na referência) — mostra o Agente Secretário/Geral respondendo uma demanda de cliente.

### 2. "Veja com os olhos do seu negócio" (seleção de nicho)
- Cards clicáveis para os 5 nichos-alvo: Restaurantes e Delivery, Advogados, Arquitetos e Engenheiros, Profissionais da Saúde, Estética.
- Ao clicar, a página troca exemplos (texto e prints de conversa) para o contexto daquele nicho — replica a lógica de personalização da referência, mas pode nascer como uma versão mais simples: cada card leva a uma seção específica na mesma página, sem precisar de troca dinâmica completa no MVP.

### 3. "Uma semana de trabalho da sua agência" (jornada narrada)
Sequência de 4-5 blocos, cada um com horário/dia e um "print" de tela mostrando o sistema em ação:
1. **Segunda, 09h** — cliente manda demanda pelo WhatsApp ("preciso de 5 posts para o feed desta semana")
2. **Segunda, 09h02** — Agente Secretário organiza o pedido, Agente Geral distribui para Design e Social Media
3. **Terça, 14h** — peças prontas aparecem no painel do cliente para aprovação
4. **Quarta** — Agente de Tráfego ajusta uma campanha sozinho porque o custo por resultado subiu (mostrar decisão automática)
5. **Sexta** — relatório semanal chega automaticamente com métricas e sugestões do Agente Analítico

### 4. "O que está por trás" (os agentes, explicados de forma simples)
- Não expor os 9 agentes como "features técnicas". Agrupar em 4 blocos de valor, cada um citando os agentes por trás sem parecer um manual técnico:
  - **Estratégia e Inteligência** (Geral, Growth, Estratégia, Analítico)
  - **Criação** (Design, Vídeo, Social Media)
  - **Aquisição de Clientes** (Tráfego)
  - **Atendimento** (Secretário / WhatsApp)

### 5. Prova / diferencial vs. agência tradicional
- Tabela comparativa simples: Agência tradicional vs. Vetor (tempo de resposta, custo, disponibilidade, transparência de relatório). Usar dados realistas, não exagerar.

### 6. Planos (espelhar estrutura clara da referência)
- Mostrar os planos definidos no documento 05 (fixo + variável), com "o que inclui" detalhado por plano, igual à clareza da referência (nada de "ilimitado" vago).
- Toggle mensal/anual se fizer sentido no MVP (pode ficar para fase 2).
- CTA por plano + link direto de WhatsApp como alternativa ao formulário (reduz fricção, como na referência).

### 7. FAQ
Perguntas mínimas para o lançamento:
- Como funciona a IA — ela erra?
- Preciso trocar de número de WhatsApp?
- Quanto tempo leva para configurar?
- Funciona para o meu tipo de negócio?
- E se eu quiser falar com uma pessoa de verdade?
- Meus dados estão seguros? (mencionar LGPD)
- Posso cancelar quando quiser?

### 8. CTA final + formulário/captura de lead
- Repetir a promessa central + formulário curto (nome, WhatsApp, tipo de negócio) — igual ao padrão da referência, que reduz fricção pedindo pouca informação.

### 9. Rodapé
- Links institucionais, redes sociais, CNPJ (quando existir), política de privacidade e termos de uso (a criar antes do lançamento — não é opcional, é exigência legal para cobrança recorrente).

---

## Requisitos técnicos da página

- Site responsivo (mobile-first — a maioria do público-alvo vai acessar pelo celular vindo de anúncio ou WhatsApp)
- Performance: carregamento rápido, imagens otimizadas (nada de vídeo autoplay pesado no hero)
- Formulário de captura conectado a um CRM ou planilha inicial (não precisa de CRM completo no MVP — ver documento 06 fase 1)
- Pixel de conversão do Meta e tag do Google configurados desde o lançamento (para já começar a treinar o próprio Agente de Tráfego de vocês com dados reais)
- Botão de WhatsApp flutuante com mensagem pré-preenchida por seção (ex: alguém que clicou no plano "Tráfego" chega no WhatsApp com contexto)

## O que pedir ao Claude Code, na prática

Ao montar o prompt de execução (ver documento 06), a instrução deve pedir:
- Stack simples para landing page (Next.js ou HTML/CSS/JS puro com um framework leve — decisão técnica no documento 04)
- Aplicar cores/tipografia do documento 01
- Copy inicial em português-BR seguindo o tom de voz do documento 01 (o Claude Code pode gerar rascunho de copy, mas revisar antes de publicar — copy final é decisão de negócio, não só técnica)
