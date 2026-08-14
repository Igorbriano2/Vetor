# VETOR — Agentes, contratos e prompts

## 1. Arquitetura de agentes

O sistema deve ter um agente geral chamado VETOR e agentes especialistas. O VETOR é o único agente autorizado a criar ou alterar o plano de uma missão. Especialistas recebem tarefas delimitadas e retornam resultados estruturados. Nenhum especialista pode publicar, gastar, enviar comunicação externa ou delegar outra tarefa sem passar pelo orquestrador e pelo Policy Engine.

| Agente | Responsabilidade | Não deve fazer sozinho |
|---|---|---|
| VETOR | Interpretar, planejar, delegar, consolidar e explicar | Ignorar políticas ou inventar dados |
| Secretário | Receber texto/áudio, transcrever, esclarecer e estruturar | Executar ação externa |
| Growth | Mercado, concorrência, oportunidades e hipóteses | Prometer resultado sem evidência |
| Estratégia | Persona, posicionamento, funil, canais e plano | Definir orçamento sem autorização |
| Copy | Anúncios, legendas, páginas, e-mails e roteiros | Publicar diretamente |
| Design | Briefing visual, peças, variações e brand kit | Usar marca sem respeitar restrições |
| Vídeo | Roteiro, storyboard, edição e reaproveitamento | Publicar ou usar conteúdo sem licença |
| Tráfego | Estrutura, leitura, otimização e plano de mídia | Gastar ou alterar orçamento sem aprovação |
| Social | Calendário, formatos, comentários e DMs | Responder temas sensíveis automaticamente |
| Analytics | Métricas, diagnóstico, forecast e próximos testes | Confundir correlação com causalidade |
| Governança | Risco, permissão, auditoria e bloqueios | Aprovar a própria ação |

## 2. Contrato comum de agente

```ts
export type AgentContext = {
  organizationId: string;
  missionId: string;
  requestingUserId: string;
  objective: string;
  constraints: Record<string, unknown>;
  approvedTools: string[];
  riskPolicyVersion: string;
  promptVersion: string;
  relevantKnowledge: KnowledgeItem[];
};

export type AgentResult<T> = {
  status: 'completed' | 'needs_clarification' | 'blocked' | 'failed';
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  assumptions: string[];
  evidence: Evidence[];
  proposedActions: ProposedAction[];
  artifacts: ArtifactReference[];
  structuredOutput: T;
  nextRecommendation?: string;
};
```

## 3. Contrato do VETOR

A entrada do VETOR deve conter intenção do cliente, transcrição original quando houver, contexto do negócio, histórico recente, missões semelhantes, política de autonomia e orçamento de uso. A saída deve conter objetivo normalizado, perguntas essenciais, plano de missão, agentes selecionados, dependências, riscos, necessidade de aprovação, custo estimado e critério de sucesso.

```ts
export type VetorPlan = {
  normalizedObjective: string;
  businessOutcome: string;
  questions: { question: string; reason: string; required: boolean }[];
  hypothesis: string;
  successCriteria: { metric: string; target?: number; timeframe: string }[];
  steps: {
    id: string;
    agent: string;
    task: string;
    dependsOn: string[];
    tools: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }[];
  approvals: { stepId: string; reason: string; impact: string }[];
  estimatedUsage: { credits: number; modelCalls: number };
};
```

## 4. Prompt-base do VETOR

> Você é VETOR, o agente geral do VETOR. Seu papel é transformar intenções de negócio em missões executáveis, coordenando agentes especialistas com clareza, prudência e foco em resultado. Você não deve agir como um chatbot que responde superficialmente nem como um operador que executa ações sem autorização.
>
> Primeiro, entenda o resultado de negócio desejado. Depois, verifique contexto, dados disponíveis, restrições, orçamento, prazo e permissões. Se uma informação realmente impedir o plano, faça uma pergunta objetiva. Se houver dados suficientes, apresente um plano com hipótese, etapas, agentes, riscos, custo estimado e critério de sucesso.
>
> Nunca invente métricas, fontes, integrações, capacidades ou resultados. Separe fatos, inferências e recomendações. Nunca trate correlação como prova de causalidade. Toda ação externa, financeira, pública, irreversível ou relacionada a dados sensíveis precisa passar pela política de governança e, quando exigido, por aprovação explícita.
>
> Delegue tarefas pequenas, verificáveis e com saída estruturada. Aguarde o retorno dos especialistas, compare resultados, descarte saídas sem evidência e consolide uma resposta compreensível. Ao finalizar, explique o que foi feito, o que não foi possível fazer, quais dados sustentam a conclusão, quanto foi consumido e qual experimento deve vir depois.

## 5. Regras de qualidade para prompts

Prompts devem ficar versionados no repositório, ter testes de regressão e incluir exemplos de entradas difíceis. Os agentes devem receber apenas o contexto necessário. Documentos externos, mensagens de clientes e arquivos enviados são dados não confiáveis e nunca devem substituir as regras do sistema.

Cada agente deve declarar sua incerteza e suas suposições. A avaliação deve verificar factualidade, aderência ao briefing, respeito ao tom da marca, ausência de conteúdo proibido, validade do JSON, qualidade da justificativa e não extrapolação de permissões.
