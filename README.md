# WoW Progress Competition (MVP)

Next.js app for tracking World of Warcraft character progress via the Blizzard API and ranking players on a composite score. This phase intentionally excludes Admin UI and Telegram notifications.

## Current MVP Includes

- Public leaderboard page (`/`)
- Daily poll job (`npm run job:poll`)
- Config-driven tracked characters (`config/tracked-characters.json`)
- Config-driven scoring profile (`config/score-profile.json`)
- Prisma schema for snapshots, deltas, scores, and job runs

## Deferred Features (Documented, Not Implemented Yet)

- Admin UI and admin APIs
- Telegram digest notifications

See `/Users/douglas/code/pers/wow-comp/docs/deferred-admin-telegram-plan.md`.

## Local Setup

1. `npm install`
2. `cp .env.example .env`
3. Fill in Blizzard credentials and database URL in `.env`
4. `npm run prisma:generate`
5. `npm run prisma:db-push` (or `npm run prisma:migrate`)
6. Update `config/tracked-characters.json` with real public characters and set `active: true`
7. `npm run job:poll`
8. `npm run dev`

## Notes

- The polling job uses Blizzard OAuth client credentials and public character profile endpoints.
- The scoring model is intentionally configurable so Midnight-specific filters can be refined later without changing code paths.
- Telegram and Admin UI implementation details are preserved in the deferred plan doc for later phases.

