# 08 — Deploy na DigitalOcean

> Guia para colocar o Vetor no ar numa DigitalOcean real, pra você conseguir ver o sistema
> funcionando de fora (não só rodando local no Claude Code). Fora comprar o domínio e apontar o
> nome de servidor (DNS) pra DigitalOcean — que você já vai fazer — isto aqui é o resto.

## 1. Decisão técnica: App Platform, não Droplet

A DigitalOcean tem dois jeitos de rodar isso:

- **Droplet** (uma VM/servidor virtual): você administra o Linux, instala Node, configura Nginx,
  certificado SSL, reinicia o processo se cair, etc. Mais trabalho manual e mais chance de erro.
- **App Platform** (recomendado): você conecta o repositório do GitHub, a DO builda e roda a
  aplicação sozinha, gera HTTPS automático quando você aponta o domínio, e reinicia sozinha se
  cair. É o caminho certo para quem não vai administrar servidor no dia a dia.

Este guia usa **App Platform**.

## 2. Estrutura: 3 aplicativos separados na DO

O projeto tem 3 partes que rodam de forma independente (documento 04). Cada uma vira um
"App" separado na DigitalOcean, apontando para uma subpasta do mesmo repositório:

| Parte | Pasta no repo | Sugestão de (sub)domínio |
|---|---|---|
| Landing page | `apps/landing` | `seudominio.com.br` |
| Painel do cliente | `apps/painel` | `painel.seudominio.com.br` |
| Backend dos agentes (webhooks WhatsApp/Asaas) | `apps/agentes` | `api.seudominio.com.br` |

Já deixei os 3 arquivos de configuração prontos em `.do/app-landing.yaml`, `.do/app-painel.yaml`
e `.do/app-agentes.yaml` — você só vai colar cada um na tela da DO (passo 4).

## 3. O que você precisa fazer (checklist)

1. **Criar conta na DigitalOcean** (digitalocean.com) e cadastrar forma de pagamento.
2. **Autorizar a DO a acessar o GitHub**: no painel da DO, ao criar o primeiro App, ela pede pra
   conectar sua conta GitHub e escolher quais repositórios ela pode ver — autorize o repositório
   `Igorbriano2/Vetor`.
3. **Criar os 3 Apps**, um de cada vez:
   - Na DO, clique em "Create" → "Apps".
   - Escolha o repositório `Igorbriano2/Vetor`, branch `main`.
   - A DO vai tentar detectar a pasta sozinha — ignore, vá até "Edit Your App Spec" (ou "App Spec"
     no menu) e **cole o conteúdo de um dos arquivos `.do/app-*.yaml`** no lugar do que ela gerou.
   - Antes de confirmar, preencha os campos marcados como `SECRET` no arquivo (ver seção 4) —
     nunca ficam salvos no repositório, só dentro da DO.
   - Repita para os 3 arquivos (`app-landing`, `app-painel`, `app-agentes`).
4. **Comprar o domínio e apontar pra DO** (a parte que você já vai fazer): depois que os Apps
   existirem, a tela de "Settings → Domains" de cada App mostra exatamente quais registros DNS
   criar (geralmente um `CNAME` apontando pro endereço que a DO gera, tipo `nome-do-app.ondigitalocean.app`).
   Isso é feito no painel do seu provedor de domínio (Registro.br, GoDaddy, etc.), não na DO.
5. **Esperar o certificado HTTPS** — a App Platform emite automaticamente assim que o domínio
   aponta certo. Não precisa configurar nada manualmente (isso é o principal ganho de não usar
   Droplet).

## 4. Variáveis de ambiente reais (os campos `SECRET`)

Nenhuma chave real está no repositório (por segurança — ver `.gitignore`). Na hora de criar cada
App na DO, preencha:

| App | Variável | Onde conseguir |
|---|---|---|
| landing | `SUPABASE_SERVICE_ROLE_KEY` | supabase.com → projeto `vetor` → Project Settings → API → `service_role` |
| agentes | `SUPABASE_SERVICE_ROLE_KEY` | mesmo lugar acima |
| agentes | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| agentes | `WHATSAPP_*` | Meta for Developers, depois de criar o app do WhatsApp Business (ver docs/03 e docs/06, comando 1.3) |
| agentes | `ASAAS_*` | asaas.com → conta sandbox (ver docs/05) |
| agentes | `OPENAI_API_KEY` | só se for ativar transcrição de áudio de verdade (ver docs/07, seção 4) — pode deixar em branco por enquanto |

**Pode publicar sem preencher os campos do WhatsApp/Asaas/OpenAI ainda.** O sistema sobe
normalmente em modo sandbox (`WHATSAPP_MODE=sandbox`, `ASAAS_ENV=sandbox`, `STT_PROVIDER=sandbox`)
— você já consegue ver a landing page, o painel e confirmar que o backend está de pé (`/health`)
antes de ligar qualquer integração com dinheiro ou número de WhatsApp real.

## 5. Custo estimado

Cada App no menor plano (`basic-xxs`) fica em torno de **US$ 5/mês**. Com os 3 Apps, o total fica
perto de **US$ 15/mês** (± R$ 85-90, câmbio variável) — fora o domínio, que você compra à parte.
O Supabase continua no plano gratuito por enquanto (documento 04).

## 6. Depois que estiver no ar

- Todo `git push` para a branch `main` do repositório redeploya os 3 Apps automaticamente
  (`deploy_on_push: true` nos arquivos de spec).
- Pra trocar uma variável de ambiente depois, é em cada App → Settings → App-Level Environment
  Variables (ou dentro do componente) — não precisa mexer em código nem redeployar manualmente, a
  DO reinicia sozinha.

## 7. Ação pendente se os Apps já existem: "Fale com o Vetor"

Se você já criou os 3 Apps antes desta seção existir, falta adicionar 2 variáveis novas pra o
chat com o Vetor dentro do painel funcionar (docs/STATUS.md tem a explicação completa):

1. Gere uma string aleatória qualquer (ex: um UUID) — vai ser o `INTERNAL_API_TOKEN`.
2. No App **agentes** → Settings → Environment Variables: adicione `INTERNAL_API_TOKEN` (tipo
   Secret) com essa string.
3. No App **painel** → Settings → Environment Variables: adicione o **mesmo** `INTERNAL_API_TOKEN`
   e também `AGENTES_API_URL` = `https://api.vetormkt.online` (ou o domínio que você usou pro app
   agentes).
4. Salvar reinicia os dois sozinho. Sem isso, o card "Fale com o Vetor" no painel mostra um erro
   claro em vez de travar — mas só passa a responder de verdade depois desse passo (e de
   `ANTHROPIC_API_KEY` real configurada no app agentes).
