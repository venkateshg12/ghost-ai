# server

The Ghost AI API: Express 5 + Prisma 8 (Postgres), BullMQ (Redis) for email, Trigger.dev for the AI
tasks. It owns auth, projects, collaborators, canvas persistence, Liveblocks room tokens and AI runs.

## Run

```bash
cp .env.example .env            # DATABASE_URL, JWT secrets, LIVEBLOCKS_SECRET_KEY, TRIGGER_SECRET_KEY, TRIGGER_PROJECT_REF
docker compose up -d redis redis-cache   # from the repo root (add `postgres` for a local DB)
pnpm db:plan init && pnpm db:apply       # first time only: create the tables
pnpm dev                        # API on :5000, also runs the BullMQ email worker in-process
pnpm trigger:dev                # runs the AI tasks locally (second terminal; needs a Trigger.dev project)
pnpm worker                     # optional: email worker as a separate process
```

## Layout

Strictly route → controller → service, as in the e-commerce backend.

| Folder | Holds |
|---|---|
| `routes/` | URL + verb + middleware → controller |
| `controllers/` | wrapped in `catchError`; validate with `@repo/types`, call one service, reply with `ok()` |
| `services/` | business logic and queries; fail fast with `appAssert` |
| `prisma/` | `contract.prisma` (edit this), generated `contract.json`/`contract.d.ts`, the `orm` client |
| `jobs/` | BullMQ email jobs: `queues/`, `producers/` (called by services), `processors/`, `workers/` |
| `trigger/` | Trigger.dev tasks: `design-agent` and `generate-spec` (configured by `trigger.config.ts`) |
| `utils/ai` | Gemini model, design operations, spec writer, server-side canvas access (`mutateFlow`) |
| `utils/liveblocks` | room bootstrap, `ai-chat` / `ai-status-feed` publishing, AI presence |
| `utils/storage` | Vercel Blob (private) with a local-disk fallback |
| `utils/ratelimiter`, `utils/cache` | copied from e-commerce: Redis limiter with memory fallback, cache-aside layer |

## API

All JSON responses use the envelope `{ status, data, meta?, errors? }`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/google` | cookie auth (access 15m, refresh 30d) |
| GET | `/auth/refresh`, `/auth/logout`, `/auth/me` | |
| GET/DELETE | `/session`, `/session/:id` | signed-in devices |
| GET/POST | `/projects` | owned + shared / create |
| GET/PATCH/DELETE | `/projects/:id` | rename/delete are owner-only |
| GET/POST/DELETE | `/projects/:id/collaborators[/:email]` | invite/remove are owner-only |
| GET/PUT | `/projects/:id/canvas` | snapshot load/save |
| GET | `/projects/:id/specs[/:specId[/download]]` | list / preview JSON / Markdown attachment |
| POST | `/ai/design`, `/ai/spec` | 202 + `{ runId, publicAccessToken }` for `useRealtimeRun`; room progress via Liveblocks feeds |
| POST | `/ai/runs/:runId/token` | fresh read-only run token, only for the user who started it |
| POST | `/liveblocks/auth` | room token after a membership check |

## Schema changes (Prisma 8)

1. Edit `src/prisma/contract.prisma`.
2. `pnpm db:plan <name>` — emits the contract and plans `migrations/app/<timestamp>_<name>/`.
3. `pnpm exec prisma migration show <name>` — read the SQL.
4. `pnpm db:apply` — writes `migration.sql`, migrates, and signs the database.
