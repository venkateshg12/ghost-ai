# Ghost AI — Turborepo rebuild

Source product: `~/Code/learning_project_1` (Next.js + Clerk + Trigger.dev, single app).
Reference architecture: `~/Code/e-commerce` (pnpm + Turborepo, Express + Prisma 8 + BullMQ, React client).

## Decisions (agreed with the user, 2026-10-07)

- **Frontend**: Next.js 16 (App Router) in `apps/web`. Server data through TanStack Query (one hook per
  operation), client state in Zustand, one axios instance with silent refresh — the e-commerce client
  patterns, ported into Next. Routing stays Next's own; TanStack Router is not added (it would be a second
  router fighting the App Router).
- **Backend**: Express 5 + Prisma 8 (`orm.Model.where().first()` contract API) in `apps/server`, layered
  route → controller → service exactly as e-commerce.
- **Auth**: e-commerce JWT access/refresh cookies + Postgres sessions + Google sign-in, replacing Clerk.
- **Background jobs**: AI tasks on Trigger.dev (`src/trigger/`, realtime status via `useRealtimeRun`);
  email on BullMQ + Redis (`jobs/queues|producers|processors|workers`) as in e-commerce. (AI was briefly
  on BullMQ; switched back to Trigger.dev at the user's request.)
- **Realtime**: Liveblocks stays. AI writes the canvas server-side with `mutateFlow`; chat and AI status
  live in Liveblocks Feeds (`ai-chat`, `ai-status-feed`) as the specs ask.
- **Artifacts**: Vercel Blob (private) for canvas JSON and specs; local `.storage/` fallback in dev.
- **Database**: nothing is applied. Schema + migration scripts only; the user runs `pnpm db:plan/db:apply`.
- **Git**: no git commands until the user asks.

## Copy map (e-commerce → ghost-ai server)

| From | Treatment |
|---|---|
| `constants/{appErrorCode,http,ratelimiter.constant,verificationLinkType}` | verbatim |
| `utils/api`, `utils/errors`, `utils/date`, `utils/auth/*` | verbatim (+ `index.ts` barrels as in mongo) |
| `utils/ratelimiter/*`, `middleware/ratelimiter`, `types/ratelimiter.types` | verbatim |
| `utils/cache/*` (mongo backend) | verbatim, wording de-Mongo'd |
| `config/redis`, `jobs/redis/connection`, email queue/producer/processor/worker | verbatim |
| `middleware/{authenticate,errorHandler,notFound,visitorId}` | verbatim + session cache from mongo |
| `routes/controllers/services` auth + session + google | verbatim minus avatar upload/cloudinary |
| `config/ratelimiter` | auth limiters verbatim; shop limiters swapped for `aiGenerateLimiter` |
| `scripts/write-migration-sql.ts`, `prisma.config.ts`, `prisma/db.ts` | verbatim |

## Phases (feature specs → monorepo)

- [x] 0. Monorepo skeleton: root package.json, turbo.json, workspace, docker-compose (redis, redis-cache, postgres)
- [x] 1. Shared packages: typescript-config, eslint-config, `@repo/types` (auth, project, canvas, ai schemas)
- [x] 2. Server foundation: copied plumbing, env, index.ts, worker.ts
- [x] 3. Schema (spec 05, 22, 28): User, Session, VerificationLink, Project, ProjectCollaborator, ProjectSpec, TaskRun
- [x] 4. Auth (spec 03): routes/controllers/services, email jobs
- [x] 5. Projects API (spec 06), access helper (spec 08), collaborators (spec 09)
- [x] 6. Liveblocks auth + room/feeds bootstrap (spec 10, 24, 25)
- [x] 7. Canvas save/load (spec 21)
- [x] 8. AI tasks: design agent (22, 23) + spec generation/persistence/download (27, 28) on Trigger.dev
- [x] 9. Web foundation: globals.css tokens, shadcn ui, providers, axios/queryClient/stores, auth pages + guards
- [x] 10. Editor home + chrome + dialogs (02, 04, 07, 08, 09)
- [x] 11. Workspace canvas: nodes, shapes, edges, toolbar, controls, templates, presence (11–19)
- [x] 12. AI sidebar: chat feed, status feed, runs, specs tab + preview (20, 24–26, 29)
- [x] 13. Verify: install, contract emit, typecheck, lint, build; update context docs + README (done 2026-10-07; see progress-tracker)

## Review

- Phases 0–12: code written for every feature spec (see `context/progress-tracker.md` for the spec → file map).
- Static check: every relative / `@/` import resolves, except `src/prisma/contract.{json,d.ts}`, which
  `prisma contract emit` generates.
- Verified 2026-10-07: install, contract emit, typecheck, lint (0 errors), production build, migration on fresh Postgres, API + UI smoke test. Left for deploy: live AI / email / Google credentials.
