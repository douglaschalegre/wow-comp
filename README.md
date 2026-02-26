# WoW Progress Competition (MVP)

Next.js app for tracking World of Warcraft character progress via the Blizzard API and ranking players on a composite score. This phase intentionally excludes Admin UI and Telegram notifications.

## Current MVP Includes

- Public leaderboard page (`/`)
- Daily poll job (`npm run job:poll`)
- Telegram digest job backend with preview/send modes (`npm run job:digest`)
- Config-driven tracked characters (`config/tracked-characters.json`)
- Config-driven scoring profile (`config/score-profile.json`)
- Prisma schema for snapshots, deltas, scores, job runs, and Telegram delivery idempotency

## Deferred Features (Documented, Not Implemented Yet)

- Admin UI and admin APIs
- Admin-managed Telegram notification settings/UI (the digest backend exists; admin integration is deferred)

See `/Users/douglas/code/pers/wow-comp/docs/deferred-admin-telegram-plan.md`.

## Local Setup

1. `npm install`
2. `cp .env.example .env`
3. Fill in Blizzard credentials and database URL in `.env`
   - Optional for Telegram send mode: set `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`
4. `npm run prisma:generate`
5. `npm run prisma:db-push` (or `npm run prisma:migrate`)
6. Update `config/tracked-characters.json` with real public characters and set `active: true`
7. `npm run job:poll`
8. Preview a digest: `npm run job:digest`
9. Send a digest (Telegram enabled): `npm run job:digest -- --send`
10. `npm run dev`

## Notes

- The polling job uses Blizzard OAuth client credentials and public character profile endpoints.
- The scoring model is intentionally configurable so Midnight-specific filters can be refined later without changing code paths.
- The Telegram digest backend is CLI-driven in v1 and uses env vars for configuration plus DB-backed delivery idempotency.
- Admin UI/API implementation details are preserved in the deferred plan doc for later phases.

## Telegram Digest Env Vars (v1 backend)

- `TELEGRAM_ENABLED` (`true` to allow send mode; preview mode ignores this)
- `TELEGRAM_BOT_TOKEN` (required for `--send`)
- `TELEGRAM_CHAT_ID` (required for `--send`)
- `TELEGRAM_LEAGUE_NAME` (optional, defaults to `WoW Midnight League`)

## Vercel Cron (Daily Poll + Telegram Digest)

This repo supports a Vercel Cron-triggered Vercel Function at `GET /api/jobs/daily` that runs:

1. the daily poll job
2. the Telegram digest job (send mode by default, preview mode with `dryRun`)

### Vercel Setup

- Add `CRON_SECRET` in your Vercel project environment variables.
- Keep Telegram send env vars set in Vercel (`TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) for production sends.
- Deploy with `vercel.json` containing the daily cron schedule for `/api/jobs/daily`.

The included cron schedule runs once per day at `15:00 UTC` (`0 15 * * *`), which is `12:00` in `UTC-03:00`.

Vercel Cron runs only on production deployments. Preview deployments do not execute cron jobs.

Vercel does not automatically retry failed cron invocations, so use Vercel logs plus the idempotent digest behavior for manual retries if needed.

### Manual Test (dry run)

Start the app locally, set `CRON_SECRET`, and call the route with auth:

```bash
curl -sS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/jobs/daily?dryRun=1"
```

`dryRun=1` still runs the poll job and DB writes, but the digest is preview-only (no Telegram send).

## Scheduler Example (local cron)

Run poll first, then digest send:

```cron
0 13 * * * cd /Users/douglas/code/pers/wow-comp && npm run job:poll
10 13 * * * cd /Users/douglas/code/pers/wow-comp && npm run job:digest -- --send
```

The digest is idempotent by Telegram chat + snapshot UTC date, so retries will skip duplicate sends after a successful delivery.
