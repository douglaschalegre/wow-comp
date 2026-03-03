# Deferred Admin UI + Telegram Notifications Plan

This document captures a decision-complete design for the future Admin UI and Telegram notification features. The current MVP intentionally does **not** implement these features yet.

## 1. Feature Goals and Non-Goals

### Goals

- Provide a secure admin interface for managing tracked characters, scoring config, and job execution.
- Allow non-code configuration changes (no editing JSON files required).
- Send a daily Telegram digest to a competition group chat summarizing leaderboard changes and milestones.
- Preserve idempotent delivery rules so rerunning jobs does not spam Telegram.
- Expose job history and failure diagnostics for operational visibility.

### Non-Goals (first deferred implementation)

- Per-user login/roles beyond a single admin password/session.
- Real-time milestone alerts (daily digest only first).
- Multiple competitions/leagues in the same app.
- End-user self-service Battle.net login/linking.
- Multi-chat Telegram subscriptions (single chat ID only in v1).

## 2. Admin UI Information Architecture and Pages

### `/admin` (Dashboard)

- High-level status cards:
  - Last poll run status/time
  - Last digest run status/time
  - Active tracked characters count
  - Current score profile version/name
- Recent failures/warnings panel
- Quick actions:
  - Run poll now
  - Send digest now
  - Preview digest

### `/admin/characters`

- Table of tracked characters with filters (`region`, `active`)
- Columns:
  - Character name
  - Realm slug
  - Region
  - Active
  - Last successful snapshot date
  - Recent error badge
- Actions:
  - Add character
  - Edit character (name/realm/region/notes/active)
  - Deactivate character
  - Re-validate character (manual API test)

### `/admin/scoring`

- Active score profile editor
- Editable fields:
  - Weight values
  - Normalization caps
  - Filter arrays (raw JSON in v1 UI)
- Preview panel:
  - Show resulting total weight
  - Highlight zeroed categories
- Save action:
  - Creates new score profile version/hash entry
  - Marks previous profile inactive
- Optional v1.1:
  - “Rebuild leaderboard with this profile” action

### `/admin/jobs`

- Job run history table (poll + digest)
- Status, duration, snapshot date, warning count, error count
- Expandable details JSON viewer
- Rerun buttons:
  - Rerun poll for today
  - Rerun digest for today (idempotent)
- Failure diagnostics:
  - Per-character errors for poll jobs

### `/admin/notifications`

- Telegram settings form:
  - Bot token (masked)
  - Chat ID
  - Timezone
  - Digest send time (local)
  - Enable/disable digest
- Digest template preview (read-only in v1)
- Test message action

## 3. Admin API Route Contracts

All admin routes return JSON in the shape:

```json
{ "ok": true, "data": {} }
```

or

```json
{ "ok": false, "error": { "code": "SOME_CODE", "message": "..." } }
```

### `GET /api/admin/characters`

- Returns paginated or full list of tracked characters (v1 can return full list).
- Includes latest snapshot status summary per character.

### `POST /api/admin/characters`

- Body:
  - `region: "US" | "EU"`
  - `realmSlug: string`
  - `characterName: string`
  - `active?: boolean`
  - `notes?: string`
- Behavior:
  - Validate payload
  - Normalize realm slug and character name
  - Reject duplicates
  - Optionally verify character exists via Blizzard API before insert

### `PATCH /api/admin/characters/:id`

- Editable fields:
  - `region`
  - `realmSlug`
  - `characterName`
  - `active`
  - `notes`
- Behavior:
  - Soft update existing record
  - Preserve historical snapshots/scores linked by `tracked_character_id`

### `DELETE /api/admin/characters/:id`

- Soft delete behavior (deactivate only)
- Response returns updated record summary

### `GET /api/admin/scoring`

- Returns active score profile config
- Includes metadata (`id`, `name`, `version`, `sourceHash`, `updatedAt`)

### `PUT /api/admin/scoring`

- Body matches `ScoreProfileConfig`
- Behavior:
  - Validate via Zod
  - Compute source hash
  - Create or reactivate matching profile
  - Mark prior active profile inactive
- Optional query flag:
  - `rebuild=true` to trigger rebuild job after save

### `GET /api/admin/jobs`

- Returns recent job runs sorted descending by `startedAt`
- Optional filters:
  - `jobType`
  - `status`
  - `limit`

### `POST /api/admin/jobs/poll`

- Triggers poll job for today
- Returns immediate result (v1 synchronous) or queued job ID (v1.1 async)
- Must guard against concurrent poll runs

### `POST /api/admin/jobs/digest`

- Modes:
  - `preview: true` returns formatted digest text without sending
  - `preview: false` sends digest (idempotent by date)
- Optional override:
  - `snapshotDate` for replay/testing if explicitly enabled in admin-only setting

### `GET /api/admin/notifications`

- Returns current notification settings (secrets masked)
- Example fields:
  - `telegramEnabled`
  - `chatId`
  - `timezone`
  - `digestHour`
  - `digestMinute`

### `PUT /api/admin/notifications`

- Updates notification settings
- Rotates stored bot token if provided
- Validates chat ID format and schedule values

## 4. Telegram Bot Setup and Message Delivery Model

### Setup model

- Create one Telegram bot via BotFather.
- Store `TELEGRAM_BOT_TOKEN` securely (env var in v1; DB-backed encrypted secret in later phase if needed).
- Store one target `TELEGRAM_CHAT_ID` (group/supergroup).
- Admin UI includes “test message” button to validate configuration.

### Delivery model (v1 deferred implementation)

- One daily digest message after a successful daily poll.
- If poll has partial failures:
  - Still send digest
  - Include warnings section listing affected characters
- If poll fails completely:
  - Send failure summary digest instead of progress standings

### Digest message structure

1. Header
   - League name
   - Snapshot date
   - Score profile name/version
2. Top leaderboard rows
   - Rank
   - Character (region/realm)
   - Score
   - Daily delta
3. Top movers section
   - Highest positive score deltas
4. Notable milestones section
   - Quest jumps
   - Reputation jumps
   - Encounter progress
   - M+ improvements
5. Warnings section (optional)
   - Missing/failed characters
   - Endpoint-specific issues

### Message formatting rules

- Use plain text or simple MarkdownV2 (plain text recommended first for reliability).
- Cap message length; truncate long milestone lists with “+N more”.
- Escape Telegram special characters when using Markdown formatting.

## 5. DB Schema Extensions Needed (Future Phase)

The current MVP intentionally excludes Telegram-specific tables. Add these later:

### `telegram_deliveries`

- `id`
- `jobRunId` (FK -> `job_runs`)
- `chatId`
- `messageType` (`daily_digest`)
- `deliveryDate` (UTC date for idempotency)
- `messageText`
- `telegramMessageId` (nullable)
- `status` (`SENT`, `FAILED`, `SKIPPED_DUPLICATE`)
- `sentAt`
- `errorJson` (nullable)

Constraints:

- Unique on (`chatId`, `messageType`, `deliveryDate`) for idempotent digest delivery.

### `app_settings`

- Key-value settings store for non-secret operational config.
- Suggested keys:
  - `telegram_enabled`
  - `telegram_chat_id`
  - `digest_timezone`
  - `digest_hour`
  - `digest_minute`
  - `digest_template_version`

### Optional later: `notification_subscriptions` (deferred beyond first Telegram implementation)

- For future multi-chat or per-user subscriptions.
- Out of scope for first Telegram release.

## 6. Security / Auth Model for Admin Access

### MVP deferred admin auth approach (first implementation)

- Single admin password (`ADMIN_PASSWORD`) checked server-side.
- Session cookie issued after login form submission.
- Cookie settings:
  - `HttpOnly`
  - `Secure` in production
  - `SameSite=Lax`
  - Short TTL (e.g. 8-12h)
- Middleware protects `/admin` routes and `/api/admin/*`.

### CSRF and abuse controls

- Require POST for mutating actions.
- CSRF token on admin forms or same-site cookie + origin checks for internal admin requests.
- Rate-limit login attempts (in-memory for local/single-instance; durable store later if needed).

### Secrets handling

- Telegram bot token should not be rendered back to UI in clear text.
- Admin notification settings endpoint returns masked token state only (`configured: true/false`).

## 7. Job Scheduling and Idempotency Rules

### Poll job

- One poll job per day for default schedule.
- Concurrency guard:
  - If a poll job is already `RUNNING`, reject new poll trigger with `JOB_ALREADY_RUNNING`.
- Idempotency:
  - Snapshot uniqueness already enforced by (`tracked_character_id`, `snapshot_date`).
  - Rerun updates the same snapshot and leaderboard rows for that day.

### Digest job

- Runs after poll job completes.
- Concurrency guard:
  - Reject if another digest is running.
- Idempotency:
  - Delivery uniqueness on (`chatId`, `messageType`, `deliveryDate`).
  - If duplicate send requested and record exists with `SENT`, return `SKIPPED_DUPLICATE`.
  - Optionally allow `force=true` for admin replay in later version (must create new message type or explicit override behavior).

### Scheduling model

- Local-first: OS cron / `launchd` calls jobs.
- Future hosted options:
  - Vercel cron routes
  - VPS cron
  - Worker queue (BullMQ/Temporal/etc.) if concurrency/scale grows

## 8. Error Handling and Observability

### Error handling rules

- Poll:
  - Per-character failures do not crash entire job unless config/auth/global dependency fails.
  - Mark overall job `PARTIAL_FAILURE` when at least one character succeeds and at least one fails.
- Digest:
  - Formatting errors fail job before sending.
  - Telegram API errors create delivery record with `FAILED`.
  - Digest may still be retried safely due idempotency rules.

### Logging

- Structured server logs for:
  - Blizzard auth failures
  - Endpoint request failures
  - Poll per-character summary
  - Digest send attempts/results
- Include identifiers:
  - `jobRunId`
  - `trackedCharacterId`
  - `snapshotDate`
  - `deliveryDate`

### Admin observability UI

- Recent error list on dashboard
- Expandable JSON details in jobs page
- Warning counts for poll/digest jobs

## 9. Test Plan and Acceptance Criteria

### Unit tests (future phase)

- Admin payload validation (`characters`, `scoring`, `notifications`)
- Digest text formatting and truncation rules
- Telegram message escaping (if Markdown formatting is used)
- Notification schedule config validation

### Integration tests

- Admin routes require auth
- Character CRUD persists correctly and rejects duplicates
- Scoring update creates/activates correct score profile
- Digest preview returns message without Telegram API call
- Digest send stores `telegram_deliveries` record and respects idempotency

### Manual test scenarios

1. Login to admin with `ADMIN_PASSWORD` and access dashboard.
2. Add character via `/admin/characters`, run poll, verify leaderboard updates.
3. Edit scoring profile via `/admin/scoring`, rebuild leaderboard, verify ranking changes.
4. Configure Telegram bot/chat, send test message, verify delivery.
5. Run digest twice on same date, verify second run is skipped as duplicate.
6. Simulate partial poll failure and verify digest warning section includes failures.

### Acceptance criteria for deferred feature release

- Admin routes and pages are protected by password session auth.
- Admin can manage tracked characters and scoring without touching JSON files.
- Daily digest sends exactly one message per day per chat (unless explicit replay override is used).
- Jobs page shows poll and digest history with actionable error details.
- Telegram failures are recorded and retryable without duplicate spam.

## 10. Rollout Plan from Current MVP

### Phase A: Admin APIs (no UI yet)

- Implement `/api/admin/*` routes for characters, scoring, jobs, notifications.
- Keep current JSON config support temporarily for migration/backward compatibility.
- Add migration script/import path to move JSON config into DB.

### Phase B: Admin UI

- Build `/admin` pages using existing APIs.
- Introduce password login + session middleware.
- Add job trigger buttons and job history views.

### Phase C: Telegram digest backend

- Add `telegram_deliveries` + `app_settings` schema changes.
- Implement digest formatter and Telegram sender module.
- Implement `POST /api/admin/jobs/digest` with preview/send modes.

### Phase D: Scheduler integration

- Configure local cron (or hosted cron) to run poll then digest.
- Add health checks/monitoring hooks if deployed remotely.

### Phase E: Cleanup and migration completion

- Deprecate JSON config files once admin-managed config is stable.
- Keep import/export capability for backup portability.

---

### Notes for future implementation

- Keep the digest pipeline reusable outside the HTTP route so it can be called by cron and manual admin triggers.
- Preserve current score snapshot schema; admin and Telegram layers should build on the existing `job_runs`, `leaderboard_scores`, and `character_metric_deltas` tables.
- Prefer simple, reliable text digests first; richer formatting can come later.

