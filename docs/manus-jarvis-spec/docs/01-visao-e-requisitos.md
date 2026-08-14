# VETOR — Visão, personas e requisitos

## 1. Problema

Pequenos negócios precisam de estratégia, conteúdo, mídia, atendimento e análise, mas normalmente encontram serviços fragmentados, pouca transparência e custos incompatíveis com sua operação. O VETOR deve centralizar a jornada em uma interface simples, sem esconder o raciocínio operacional nem obrigar o cliente a aprender ferramentas de marketing.

## 2. Personas

| Persona | Necessidade | Resultado desejado |
|---|---|---|
| Proprietário | Quer vender mais sem operar cinco ferramentas | Falar o objetivo e acompanhar impacto |
| Operador | Precisa executar campanhas e conteúdo rapidamente | Receber missões claras e entregas aprováveis |
| Aprovador | Precisa controlar marca, orçamento e riscos | Aprovar com contexto, impacto e reversibilidade |
| Analista | Precisa transformar dados em decisões | Ver hipóteses, métricas, diagnóstico e próximo teste |
| Administrador VETOR | Precisa operar planos, suporte e qualidade | Monitorar organizações, uso, falhas e auditoria |

## 3. Requisitos funcionais do MVP

O sistema deve permitir criação de conta, organização, convite de usuários, papéis e onboarding do negócio. Deve coletar vertical, localização, oferta, público, diferenciais, canais, tom da marca, objetivos, restrições e permissões.

O usuário deve criar uma missão por texto ou áudio. O sistema deve transcrever áudio, exibir a transcrição e pedir confirmação quando a confiança for baixa. O JARVIS deve gerar um plano, explicar o entendimento e solicitar apenas esclarecimentos essenciais.

O usuário deve acompanhar a missão, ver agentes envolvidos, estados, timeline, artefatos, consumo e aprovações. Deve aprovar, rejeitar, editar, comentar ou pedir uma nova versão. As entregas devem ser versionadas e armazenadas na biblioteca.

O MVP deve produzir diagnóstico, plano de campanha, copy, calendário simples, criativos estáticos e relatório analítico. O cliente deve conseguir editar o contexto do negócio e o brand kit. O produto deve apresentar sinais de crescimento, insights e recomendações, sem fingir que métricas não conectadas são completas.

O sistema deve permitir conectar WhatsApp em uma primeira versão controlada, com recebimento de mensagens e criação de solicitações. A resposta automática pode começar apenas com confirmação de recebimento, status da missão e solicitação de aprovação; ações de marketing externas devem continuar governadas.

## 4. Fora do MVP

Ficam fora do primeiro lançamento: gestão autônoma de pagamentos, promessa de resultado garantido, criação irrestrita de campanhas, publicação sem aprovação, resposta automática a temas jurídicos ou médicos sensíveis, UGC sintético sem revisão e edição de vídeo complexa em tempo real.

## 5. Requisitos não funcionais

O sistema deve ser responsivo, acessível, observável e seguro. Deve isolar dados entre organizações, suportar falhas de integração, registrar auditoria, permitir exclusão e exportação de dados, usar filas para tarefas longas e exibir estados consistentes no frontend. O tempo de resposta do comando deve mostrar feedback imediato mesmo quando a execução for assíncrona.

## 6. Regra de prioridade

Quando houver conflito entre velocidade, estética e segurança, o VETOR deve priorizar segurança e clareza. Quando houver conflito entre quantidade de funcionalidades e experiência central, priorizar o ciclo completo de uma missão bem executada.
