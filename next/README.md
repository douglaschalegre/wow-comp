# WoW Progress Competition (Next.js, MVP)

Versao Next.js (fullstack) do projeto: UI (leaderboard) + backend opcional (Postgres/Prisma + job que busca dados na API da Blizzard).

Trilhas para ensino:

- Iniciante: `src/app/*` (UI)
- Avancada: `src/server/*` (jobs, Prisma, integracoes)

Como os dados chegam na UI: `config/*` -> `npm run job` -> Postgres -> `src/server/leaderboard.ts` -> `src/app/page.tsx`.

## Quickstart (iniciante)

Requisitos: Node + Postgres.

Na raiz do repositorio:

```bash
cd next
npm install
cp .env.example .env
```

Edite `.env` e defina `DATABASE_URL`.

Depois:

```bash
npm run prisma:generate
npm run prisma:db-push
npm run dev
```

Abra `http://localhost:3000`. (Sem rodar o job, o leaderboard pode ficar vazio.)

## Popular dados (job de polling)

- Configure `BLIZZARD_CLIENT_ID` e `BLIZZARD_CLIENT_SECRET` no `.env`
- Ajuste `config/tracked-characters.json`
- Rode:
  - Preview: `npm run job -- --dry-run`
  - Execucao: `npm run job`

## Onde olhar no codigo

- UI: `src/app/page.tsx`
- Consulta do leaderboard: `src/server/leaderboard.ts`
- Job diario: `src/server/daily.ts` e `scripts/run-job.ts`
- Poll: `src/server/poll.ts`
- DB/Prisma: `prisma/schema.prisma`

## Opcional (avancado)

- Cron: `GET /api/jobs/daily` com `Authorization: Bearer $CRON_SECRET`
- Telegram digest/webhook: vars `TELEGRAM_*` em `.env.example` e `POST /api/telegram/webhook`
- Funcionalidades adiadas: `docs/deferred-admin-telegram-plan.md`
