# Descobertas verificadas — integrações

## WhatsApp Business Platform
Fonte: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
- A Cloud API permite enviar mensagens de texto, mídia rica e mensagens interativas.
- A plataforma também contempla chamadas, grupos e experiências conversacionais.
- Webhooks entregam ao servidor eventos como mensagens recebidas, status de entrega e erros assíncronos.
- Implicação para o produto: o JARVIS pode receber solicitações pelo WhatsApp, registrar eventos e devolver atualizações de tarefas; a arquitetura deve ter verificação, armazenamento de consentimento e trilha de auditoria.

## Meta Marketing API
Fonte: https://developers.facebook.com/documentation/ads-commerce/marketing-api
- A Marketing API oferece endpoints Graph API para anunciar nas tecnologias Meta.
- A documentação oficial cobre criação de campanhas, conjuntos de anúncios e criativos.
- Também contempla modificar, pausar e excluir campanhas, além de públicos e insights para otimização.
- A Conversions API conecta dados de marketing do servidor aos sistemas Meta para otimização e mensuração.
- Implicação para o produto: o agente de tráfego deve operar por níveis de autonomia, com aprovação humana para ações de risco financeiro e limites de orçamento configuráveis.
