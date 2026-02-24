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

## Scheduler Example (local cron)

Run poll first, then digest send:

```cron
0 13 * * * cd /Users/douglas/code/pers/wow-comp && npm run job:poll
10 13 * * * cd /Users/douglas/code/pers/wow-comp && npm run job:digest -- --send
```

The digest is idempotent by Telegram chat + snapshot UTC date, so retries will skip duplicate sends after a successful delivery.
