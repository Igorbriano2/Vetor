# apps/agentes

Backend dos agentes de IA (Node.js/TypeScript) e integrações externas: WhatsApp Business (Meta
Cloud API), Marketing API do Meta, Asaas. Os system prompts de cada agente vêm de
`docs/03-arquitetura-de-agentes-e-prompts-mestre.md` e estão versionados em `src/agents/prompts/`.

Todas as integrações externas iniciam em **modo sandbox** — nunca conectar número real de
WhatsApp, conta real de anúncios ou cobrança real sem testar antes. Ver `docs/STATUS.md`.

## Rodar localmente

```
cd apps/agentes
npm install
npm run dev
```
