# WoW Progress Competition (MVP)

Aplicacao Next.js para acompanhar o progresso de personagens de World of Warcraft pela API da Blizzard e ranquear jogadores com base em uma pontuacao composta.

Este repositorio esta organizado em duas trilhas para ensino:

- Trilha iniciante: `src/app/*` (somente UI e adaptador de rota)
- Trilha avancada: `src/server/*` (Prisma, integracao com Blizzard, jobs, digest no Telegram)

## O que o MVP atual inclui

- Pagina publica de leaderboard (`/`)
- Job diario unificado (poll + digest) (`npm run job`)
- Modo opcional de envio para Telegram com controle idempotente de entrega
- Personagens monitorados por configuracao (`config/tracked-characters.json`)
- Perfil de pontuacao por configuracao (`config/score-profile.json`)
- Schema Prisma para snapshots, deltas, scores, execucoes de job e idempotencia de entrega no Telegram

## Funcionalidades adiadas (documentadas, ainda nao implementadas)

- UI de admin e APIs de admin
- Configuracao/notificacoes de Telegram gerenciadas por admin (o backend Telegram existe; a integracao de admin foi adiada)

Veja `docs/deferred-admin-telegram-plan.md`.

## Setup local

1. `npm install`
2. `cp .env.example .env`
3. Preencha credenciais da Blizzard e URL do banco no `.env`
   - Opcional para modo de envio Telegram: defina `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`
4. `npm run prisma:generate`
5. `npm run prisma:db-push` (ou `npm run prisma:migrate`)
6. Atualize `config/tracked-characters.json` com personagens publicos reais e `active: true`
7. Dry run (poll + preview do digest): `npm run job -- --dry-run`
8. Modo envio (poll + digest Telegram, com variaveis Telegram configuradas): `npm run job`
9. `npm run dev`

## Arquitetura

- `src/app/*`: camada web voltada aos alunos
  - `src/app/page.tsx`: pagina da leaderboard e renderizacao da tabela
  - `src/app/api/jobs/daily/route.ts`: adaptador de cron/webhook com auth
- `src/server/*`: camada avancada de backend
  - `poll.ts`: fetch Blizzard + normalizacao + pontuacao + escrita no banco
  - `digest.ts`: consulta do digest + formatacao + envio Telegram/idempotencia
  - `daily.ts`: orquestracao de poll + digest e contrato de resultado da execucao
  - `leaderboard.ts`: modelo de consulta da classificacao mais recente
  - `config.ts`, `blizzard.ts`, `metrics.ts`, `prisma.ts`, `env.ts`, `types.ts`: internals compartilhados do servidor
  - `rebuild.ts`: job avancado de rebuild da leaderboard

## Observacoes

- O job de polling usa OAuth client credentials da Blizzard e endpoints publicos de perfil de personagem.
- O modelo de pontuacao e propositalmente configuravel para ajustar filtros especificos de Midnight sem alterar os caminhos de codigo.
- O job diario na v1 e via CLI (`npm run job`) e usa variaveis de ambiente para configuracao do Telegram, com idempotencia de entrega baseada no banco.
- Detalhes de implementacao de UI/API de admin ficam preservados no documento de plano adiado para fases futuras.

## Objetivos avancados

- Rebuild manual dos snapshots da leaderboard:
  - `npm run job:rebuild-leaderboard`
- Webhook cron de producao:
  - `GET /api/jobs/daily` com `Authorization: Bearer $CRON_SECRET`
- Modo de envio Telegram:
  - defina `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Webhook de comando Telegram (`/update`):
  - `POST /api/telegram/webhook` com header `X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET`

## Variaveis de ambiente do Telegram Digest (backend v1)

- `TELEGRAM_ENABLED` (`true` para permitir modo envio; o dry-run ignora isso)
- `TELEGRAM_BOT_TOKEN` (obrigatorio para modo envio)
- `TELEGRAM_CHAT_ID` (obrigatorio para modo envio)
- `TELEGRAM_LEAGUE_NAME` (opcional, padrao `WoW Midnight League`)
- `TELEGRAM_WEBHOOK_SECRET` (obrigatorio para processar comandos no webhook Telegram)

## Comando `/update` no Telegram

Esta versao inclui o endpoint `POST /api/telegram/webhook` para receber updates do bot Telegram.

Quando uma mensagem de comando `/update` (ou `/update@seu_bot`) chega no chat configurado em `TELEGRAM_CHAT_ID`, o backend executa:

1. `runPollJob()` para atualizar snapshots/scores
2. `runDigestJob({ mode: "preview", snapshotDate })` para montar o texto atualizado
3. envio da mensagem formatada para o mesmo chat via bot

Requisitos:

- `TELEGRAM_ENABLED=true`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` configurados
- webhook do Telegram registrado com o mesmo secret token

Exemplo de registro do webhook (troque placeholders):

```bash
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/telegram/webhook",
    "secret_token": "'$TELEGRAM_WEBHOOK_SECRET'"
  }'
```

Opcional (recomendado): registre o comando para autocomplete no cliente Telegram:

```bash
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      { "command": "update", "description": "Atualiza dados e envia digest" }
    ]
  }'
```

## Vercel Cron (poll diario + Telegram Digest)

Este repositorio suporta uma Vercel Function acionada por Vercel Cron em `GET /api/jobs/daily`, que executa:

1. o job diario de poll
2. o job de digest Telegram (modo envio por padrao, modo preview com `dryRun`)

### Setup no Vercel

- Adicione `CRON_SECRET` nas variaveis de ambiente do projeto no Vercel.
- Mantenha variaveis de envio Telegram configuradas no Vercel (`TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) para envios em producao.
- Faça deploy com `vercel.json` contendo o agendamento diario de cron para `/api/jobs/daily`.

O agendamento incluido executa uma vez por dia as `15:00 UTC` (`0 15 * * *`), que corresponde a `12:00` em `UTC-03:00`.

Vercel Cron roda apenas em deploys de producao. Deploys de preview nao executam jobs de cron.

O Vercel nao faz retry automatico para invocacoes de cron com falha, entao use logs do Vercel junto do comportamento idempotente do digest para retries manuais quando necessario.

### Teste manual (dry run)

Inicie o app localmente, defina `CRON_SECRET` e chame a rota com auth:

```bash
curl -sS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/jobs/daily?dryRun=1"
```

`dryRun=1` ainda executa o job de poll e escreve no banco, mas o digest fica apenas em preview (sem envio para Telegram).

## Exemplo de agendador (cron local)

Execute o job diario unificado:

```cron
0 13 * * * cd /path/to/your/repo/next && npm run job
```

O digest e idempotente por chat do Telegram + data UTC do snapshot, entao retries vao pular envios duplicados apos uma entrega bem-sucedida.
