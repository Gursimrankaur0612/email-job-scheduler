# Email Job Scheduler

**Live:** [Frontend](https://emailjobscheduler-production.up.railway.app) · [Backend](https://fulfilling-dream-production-4d89.up.railway.app) · [Ethereal inbox](https://ethereal.email)



Schedule bulk emails to send later, spread across multiple sender identities, with a Redis-backed hourly rate limit per sender and a minimum delay between sends. Backend is Express + Prisma/Postgres + BullMQ/Redis; frontend is Next.js (App Router) with real Google OAuth via NextAuth. Built and manually verified end-to-end against a real Postgres/Redis/Ethereal stack — see the Architecture section for what was actually tested, not just implemented.

## Stack

- **Backend**: Express, TypeScript, Prisma (Postgres), BullMQ (Redis), nodemailer, zod
- **Frontend**: Next.js App Router, TypeScript, Tailwind, NextAuth.js (Google OAuth), Tiptap, papaparse
- **Infra**: Postgres + Redis via `docker-compose` (Redis runs with AOF persistence)

---

## 1. Setup

Assumes you've never seen this repo. Node 20+, Docker (or Colima) running, and network access for Google OAuth / Ethereal.

### Install

```bash
npm install
```

This is an npm-workspaces monorepo (`backend`, `frontend`) — one install at the root covers both.

### Configure environment

```bash
cp .env.example .env
```

There is **one `.env` file for the whole repo**, at the root — shared by `docker-compose.yml`, `/backend`, and `/frontend`. Both apps load it explicitly rather than relying on default behavior, because the default behavior doesn't work here:

- `backend/src/index.ts` loads it via `dotenv.config({ path: path.resolve(__dirname, "../../.env") })`, not the default `import "dotenv/config"`. That default resolves relative to `process.cwd()`, and `cwd` is `backend/` when the process is started through the root `npm run dev` workspace script — so it would silently miss the root `.env` and crash with `Environment variable not found: DATABASE_URL`. Hit this exact bug during development; fixed by resolving the path explicitly instead.
- `frontend/next.config.mjs` has a ~20-line hand-rolled parser (no `dotenv` dependency) that reads `../.env`, since Next.js only auto-loads env files from its own project directory.

Fill in `.env`:

- **`DATABASE_URL` / `REDIS_URL`** — defaults work as-is with the docker-compose setup below, no changes needed.
- **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** — create an OAuth 2.0 Client ID at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) (Application type: **Web application**). Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (NextAuth builds this itself from `NEXTAUTH_URL` — there's no separate redirect-URI env var to set).
- **`NEXTAUTH_SECRET`** — `openssl rand -base64 32`
- **`NEXTAUTH_URL`** — leave as `http://localhost:3000` for local dev.
- **`MAX_EMAILS_PER_HOUR_PER_SENDER` / `WORKER_CONCURRENCY` / `MIN_DELAY_MS`** — defaults (`100` / `5` / `1000`) are reasonable for local testing; see Architecture for what each actually does.
- **`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM`** — these exist in `.env.example` but **nothing in the codebase reads them**. Real sending uses per-sender SMTP credentials stored in the database instead (see step 5). Left over from the initial scaffold before the multi-sender requirement landed — see Assumptions.

### Start Postgres + Redis

```bash
npm run docker:up
```

Redis runs with `--appendonly yes` (AOF), so queued/scheduled jobs survive a container restart. Sanity check: `docker compose logs redis | grep -i aof` should show it creating AOF base/incr files on startup.

### Run the database migration

```bash
npm run db:migrate --workspace backend
```

(equivalent to `cd backend && npx prisma migrate dev`.) Creates `senders`, `scheduled_emails`, `rate_limit_events` in Postgres.

### Start the app

```bash
npm run dev
```

Runs docker + backend (`localhost:4000`) + frontend (`localhost:3000`) together via `concurrently`. Or run pieces separately: `npm run dev:backend`, `npm run dev:frontend`.

### Create a sender (Ethereal test account)

There's no "connect your email" UI flow yet — a sender is a row in the `senders` table with its own SMTP credentials, created via `POST /senders`. For local testing, generate a free throwaway Ethereal account and register it:

```bash
node -e "require('nodemailer').createTestAccount().then(a=>console.log(JSON.stringify(a)))"
```

then, with the backend running:

```bash
curl -X POST http://localhost:4000/senders \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Test Sender",
    "email": "<user from above>",
    "smtpHost": "smtp.ethereal.email",
    "smtpPort": 587,
    "smtpUser": "<user from above>",
    "smtpPassword": "<pass from above>"
  }'
```

Sent mail is captured at [ethereal.email](https://ethereal.email) (log in with that same user/pass) — nothing is delivered to a real inbox. The worker also logs a direct Ethereal preview URL for every send.

### Verify it's all working

- `curl http://localhost:4000/health` → `{"status":"ok"}`
- Open `http://localhost:3000` → redirects to `/login` → "Login with Google" → real OAuth consent screen → lands on `/dashboard`.
- Compose an email to the sender created above, check the Ethereal web inbox for it landing.

### Live deployment

A hosted version is running at:

- Frontend: https://emailjobscheduler-production.up.railway.app
- Backend: https://fulfilling-dream-production-4d89.up.railway.app

Infra is Railway (Postgres + Redis + backend + frontend, 4 separate services in one project).

**Important:** same as local dev, there's no "connect a sending account" UI — a sender must be created directly against the production backend before Compose will show a "From" option. Generate a throwaway Ethereal account and register it:

```bash
node -e "require('nodemailer').createTestAccount().then(a=>console.log(JSON.stringify(a)))"
```

then:

```bash
curl -X POST https://fulfilling-dream-production-4d89.up.railway.app/senders \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Test Sender",
    "email": "<user from above>",
    "smtpHost": "smtp.ethereal.email",
    "smtpPort": 587,
    "smtpUser": "<user from above>",
    "smtpPassword": "<pass from above>"
  }'
```

Sent mail is captured at [ethereal.email](https://ethereal.email) (log in with that same user/pass), not delivered to a real inbox.

---

## 2. Architecture

### Data model

Three tables (`backend/prisma/schema.prisma`): `senders` (one SMTP identity per row — display name, email, host/port/user/password), `scheduled_emails` (one row **per recipient**, `status` of `scheduled`/`sent`/`failed`, `bullmq_job_id` linking it to its queue job), `rate_limit_events` (audit trail — every time the rate limiter rejects a send and reschedules it, keyed to the sender and the specific email row).

### Scheduling: BullMQ delayed jobs with deterministic jobIds

When `POST /emails/schedule` creates a `scheduled_emails` row, `queue/producer.ts` immediately adds a BullMQ job with `delay = max(scheduledAt - now, 0)` and a **jobId derived from the row's own primary key**: `email-${row.id}` (`queue/emailQueue.ts`). (Originally `email:${id}` per the initial spec, but BullMQ 6.x rejects `:` in custom job IDs — it's reserved for its own internal key namespacing — so `-` is used instead.)

That determinism is the load-bearing design choice here: the producer, the worker, and the reconciler independently compute the same jobId from the same row, so there's no separate mapping table to keep in sync — "does this row already have a live job" is just `queue.getJob(jobId)`.

### Restart-persistence and idempotency

Two independent, deliberately redundant layers:

1. **Redis AOF persistence** (`docker-compose.yml`: `redis-server --appendonly yes`, on a named volume). A BullMQ delayed job lives in Redis; killing the Node process doesn't touch it — Redis has it on disk, and a new `Worker` instance just picks the existing timer back up on restart. Verified manually, not just in theory: scheduled an email ~100s out, `kill -9`'d the backend mid-wait (confirmed via `lsof` that the port was fully released, not just the parent process), waited, restarted — the email sent within ~5 seconds of its original scheduled time.

2. **`reconcileScheduledJobs()`** (`queue/reconcile.ts`), run once at startup right after `app.listen`. This is the layer for when AOF *doesn't* save you — a DB row is `status: "scheduled"` but its BullMQ job is genuinely missing from Redis (Redis data loss, or the original `queue.add()` failed after the DB row had already committed). This actually happened once during development: a jobId validation error left rows committed with no matching job, and reconcile correctly picked them up and requeued them on the next restart. It queries every `scheduled` row, checks `queue.getJob(jobId)`, and for anything missing, re-adds it with the delay recalculated from the current time (`0` if the original time already passed).

**Idempotency guard against double-send**: before doing anything, the worker re-fetches the row and checks `status === "scheduled"` (`queue/worker.ts`). This covers the narrow race where reconciliation and the original job could both end up targeting the same row — e.g. reconcile's `getJob` check misses by a hair right as the original job is finishing. Whichever one gets there first flips `status` away from `scheduled`, so the second is a no-op.

### Rate limiting, concurrency, and minimum delay

Three independent, env-configurable knobs:

**`MAX_EMAILS_PER_HOUR_PER_SENDER`** — enforced *inside the worker*, not at schedule time, via a Redis `INCR` + `EXPIRE` fixed-window counter keyed `ratelimit:{senderId}:{hourWindowStart}` (`queue/rateLimiter.ts`).

This was chosen over BullMQ's built-in `limiter` option deliberately. BullMQ's limiter throttles the rate at which the worker *dispatches* jobs — it has no concept of "this job turned out not to need sending." A job the hourly cap rejects and reschedules does zero SMTP work, but the built-in limiter would still burn its dispatch slot on it regardless. Confirmed this the hard way: with `MIN_DELAY_MS=1000` and the limiter wired at the dispatch level, running the 1000-job load test meant ~16 minutes of pure pacing before the queue even finished *classifying* which jobs were rate-limited, because rejections were paced exactly like real sends. A counter checked inside the job handler has no such coupling — rejection-and-reschedule is near-instant regardless of pacing.

When over the limit, the job isn't failed — it's moved to the next clock hour via `job.moveToDelayed(nextHourStart, token)` followed by `throw new DelayedError()` (BullMQ's documented signal that a job was intentionally delayed, not actually finished — confirmed in the installed v6.2.1 source that this specifically skips the normal `failed` event, so it never shows up as an error). Every reschedule also writes a `rate_limit_events` row.

*The `EXPIRE` race, and its fix:* `INCR` itself is atomic — Redis is single-threaded, so two concurrent `INCR`s on the same key are always serialized into two different sequential values, meaning two workers can never both "win" the same last slot. But `INCR` and `EXPIRE` are two separate round-trips. Originally `EXPIRE` was only set when `count === 1`; if the process crashed between those two calls on that specific first hit of an hour, the key would never get a TTL and would sit in Redis indefinitely. Fixed by calling `EXPIRE` unconditionally on *every* `INCR`, not just the first — any later call on the same key re-establishes the TTL, so a lost `EXPIRE` from an earlier crash self-heals on the next send attempt for that sender.

**`WORKER_CONCURRENCY`** — passed straight to BullMQ's `Worker` constructor as `concurrency`: how many jobs run in parallel.

**`MIN_DELAY_MS`** — deliberately *not* BullMQ's `limiter` either, for the same reason as above: it should only pace real sends, not rate-limit rejections. Implemented as a Redis-backed "time since last send" check (`queue/minDelay.ts`), called right before the actual `sendMail`, not at job dispatch. It's a plain `GET` then `SET`, not atomic — see Assumptions.

### Load testing

`backend/scripts/loadtest.ts` (`npm run loadtest --workspace backend -- --count=1000 --senders=5 --wait-ms=45000`) creates real Ethereal senders, enqueues N emails across them at ~the same timestamp, then polls and reports `sent` / `failed` / `still-scheduled` / `rate-limited-and-rescheduled`, asserting the buckets always sum to the total enqueued — i.e. nothing silently disappears. At 1000 emails across 5 senders with a 15/hour cap: **76 sent, 924 rate-limited-and-rescheduled, 1000/1000 accounted for**, matching the expected ~75 (5 × 15) almost exactly.

---

## 3. API reference

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | liveness check |
| `POST` | `/senders` | create a sender; `409` on duplicate email |
| `GET` | `/senders` | paginated, sorted by `createdAt`; `smtpPassword` excluded from the response |
| `POST` | `/emails/schedule` | body: `senderId, subject, body, recipients (string \| string[]), scheduledAt, delayBetweenEmailsMs?, hourlyLimit?` — creates one `scheduled_emails` row per recipient, staggered by the effective delay |
| `GET` | `/emails/scheduled` | paginated, sorted by `scheduledAt` |
| `GET` | `/emails/sent` | paginated, sorted by `sentAt` |

All routes validate input with zod (`backend/src/validation/`) and return `400` with per-field messages on bad input.

---

## 4. Feature checklist

### Summary (mapped to brief)

**Backend:**
- Scheduler — BullMQ delayed jobs with deterministic `jobId`s, `POST /emails/schedule`
- Persistence — Redis AOF + `reconcileScheduledJobs()` startup reconciler, survives process kill
- Rate limiting — Redis `INCR`+`EXPIRE` fixed-window counter per sender, over-limit jobs rescheduled not failed
- Concurrency — `WORKER_CONCURRENCY` passed to BullMQ `Worker`, independently verified

**Frontend:**
- Login — NextAuth.js with real Google OAuth
- Dashboard — sidebar nav, live Scheduled/Sent count badges, search/filter/refresh bar
- Compose — From/To/Subject/Body with rich text, CSV upload, schedule popover, delay & hourly-limit inputs
- Tables — shared `Table`/`StatusBadge`/`EmptyState` components across Scheduled and Sent views

---

### Detailed checklist

#### Scaffold & infra
- [x] TypeScript monorepo: `/backend` (Express) + `/frontend` (Next.js + Tailwind)
- [x] `docker-compose.yml`: Postgres + Redis, Redis with `--appendonly yes` on a named volume
- [x] Shared root `.env.example`, every var commented
- [x] Root `package.json` scripts to run backend + frontend + docker together (`npm run dev`)

#### Data model & scheduling API
- [x] Prisma schema: `senders`, `scheduled_emails`, `rate_limit_events`; migration checked in
- [x] `POST /emails/schedule` — accepts single or bulk recipients (incl. CSV-parsed arrays from the frontend), one row per recipient, zod-validated, clear `400`s
- [x] `GET /emails/scheduled`, `GET /emails/sent` — pagination + sort by `scheduledAt`/`sentAt`
- [x] `POST /senders`, `GET /senders` — password excluded from list responses

#### Queue, worker, restart-survival, rate limiting
- [x] BullMQ producer: delayed job, deterministic `jobId` from the DB row
- [x] Worker: re-checks `status === "scheduled"` before sending (double-processing guard), sends via nodemailer using the sender's own SMTP credentials, updates DB to `sent`/`failed` with error message on failure
- [x] `reconcileScheduledJobs()` runs on startup, requeues any `scheduled` row missing a live BullMQ job
- [x] Restart-survival manually verified with a real process kill mid-wait (see Architecture)
- [x] `MAX_EMAILS_PER_HOUR_PER_SENDER` via Redis `INCR`+`EXPIRE`; over-limit jobs are rescheduled, not failed
- [x] `WORKER_CONCURRENCY`, `MIN_DELAY_MS` both wired and independently verified
- [x] Load test script: 1000+ emails, verified no drops
- [x] `EXPIRE` race condition identified and fixed

#### Auth & dashboard
- [x] NextAuth.js with real Google OAuth (no mocking); env loaded from the shared root `.env`
- [x] Login page matching the supplied design
- [x] Dashboard: sidebar (wordmark, user card + dropdown + working logout, Compose button, Scheduled/Sent nav with live count badges)
- [x] Main panel: search/filter/refresh bar, list from `GET /emails/scheduled`/`/emails/sent`, status pills, loading skeletons, empty states

#### Compose flow
- [x] Header: back arrow, title, paperclip with attachment count badge, schedule popover, Send/Send Later pill
- [x] From: dropdown of real senders fetched from `GET /senders`
- [x] To: chip-based recipient field, CSV upload via papaparse, overflow collapse past 3 chips, "N recipients detected" summary
- [x] Subject, Delay-between-sends and Hourly-limit inputs
- [x] Rich text body editor (Tiptap) — bold/italic/underline/align/list/quote toolbar
- [x] Schedule popover: date/time picker + the four quick-picks + Cancel/Done
- [x] Submit → `POST /emails/schedule`, loading state on the button, success/error toast
- [x] Shared `Table`, `StatusBadge`, `EmptyState` components used by both list views
- [x] Sidebar's Compose button navigates to the view

---

## 5. Assumptions and trade-offs

Things I know are incomplete or simplified, stated plainly rather than glossed over:

- **Attachments are visual-only.** The paperclip in Compose is a real file picker and shows a real count badge, but selected files are never sent — `scheduled_emails` has no attachment storage, and `POST /emails/schedule` has no field for it. There's no backend support to build against yet.
- **CSV recipient parsing is a heuristic, not a strict contract.** `frontend/src/lib/csv.ts` looks for a header column matching `/email/i` case-insensitively; if none is found, it falls back to scanning every cell in every row for anything email-shaped. Works well for normal exports (any column literally or approximately named "email"), but a CSV with an ambiguous header and emails in a non-obvious place could be misread.
- **The global `SMTP_*` vars in `.env.example` are dead.** Nothing reads them — real sending always uses the per-sender credentials stored in `senders`, added once the multi-sender-identity requirement landed. Left them in the example file rather than doing a separate cleanup pass; worth removing.
- **`MIN_DELAY_MS` pacing is not atomic** — a plain Redis `GET` then `SET` (`queue/minDelay.ts`), not a Lua script. Under real concurrent workers, two sends could occasionally land slightly closer together than the configured delay. Acceptable for "avoid tripping a provider's spam heuristics"; not a hard real-time guarantee.
- **The hourly rate limiter is a naive fixed window, not sliding.** A sender could send close to 2× its hourly cap if timed right around a window boundary (N at 12:59:59, another N at 13:00:00). Standard trade-off of the fixed-window approach; not hardened against.
- **No automated test suite.** Everything here was verified through live manual runs against the real Postgres/Redis/Ethereal stack during development — restart-kill tests, load tests with real numeric assertions, direct `curl` checks of exact request/response shapes — documented inline in the Architecture section, but none of it is committed as an automated test you can just run.
- **Search and Filter in Compose/dashboard are visual only** (explicitly out of scope when built); Refresh is real and actually refetches.
- **No "connect a sending account" UI.** Senders only exist via direct `POST /senders` calls (see Setup) — there's no frontend flow to add one yet.
- **No browser-driven visual QA during development.** The Chrome extension used for click-through/screenshot testing wasn't connected in the environment this was built in, so UI verification leaned on full `next build`/`tsc` passes and direct backend integration checks (e.g. POSTing the exact payload shape the Compose form constructs and confirming the response) rather than actually clicking through the rendered pages. Worth a manual pass before considering the frontend fully verified.
