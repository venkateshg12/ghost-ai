# Ghost AI

A real-time collaborative system design workspace. Describe a system in plain English, an AI agent maps
it onto a shared canvas, collaborators refine it together, and the app turns the graph into a Markdown
technical specification.

pnpm + Turborepo monorepo, structured like `~/Code/e-commerce`.

```
apps/
  server/   Express 5 · Prisma 8 (Postgres) · Trigger.dev (AI tasks) · BullMQ (email) · Liveblocks node · Gemini
  web/      Next.js 16 (App Router) · TanStack Query · Zustand · axios · React Flow · Liveblocks
packages/
  types/              @repo/types — Zod schemas + types shared by server and web
  typescript-config/  shared tsconfig bases
  eslint-config/      shared ESLint configs
context/    product, architecture, UI and code-standard docs + the 29 feature specs
```

## Getting started

Requirements: Node 20.9+, pnpm 9+, Docker (for Redis, optionally Postgres), a Liveblocks project, a
Trigger.dev project.

```bash
pnpm install

# Redis for queues/rate limiting (6379) and the cache (6380). Add `postgres` for a local database.
docker compose up -d redis redis-cache

cp apps/server/.env.example apps/server/.env   # DATABASE_URL, JWT secrets, LIVEBLOCKS_SECRET_KEY, TRIGGER_*
cp apps/web/.env.example apps/web/.env.local   # NEXT_PUBLIC_API_URL

# First time only: create the tables (Prisma 8 contract workflow)
pnpm --filter server db:plan init
pnpm --filter server db:apply

pnpm dev           # web on :3000, API on :5000 (the API also runs the BullMQ email worker)
pnpm dev:trigger   # second terminal: runs the AI tasks locally through the Trigger.dev CLI
```

Optional keys: `GOOGLE_GENERATIVE_AI_API_KEY` (without it the AI uses deterministic offline
generators), `BLOB_READ_WRITE_TOKEN` (without it artifacts go to `apps/server/.storage/`),
`RESEND_API_KEY` (without it emails are printed to the API console), `GOOGLE_CLIENT_ID` /
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google sign-in).

## Commands

```bash
pnpm dev | build | lint | typecheck        # all workspaces through turbo
pnpm --filter server dev | worker          # API / standalone worker process
pnpm --filter web dev                      # Next.js only
```

## How it fits together

- **Auth** — email/password (+ Google) on the API. Access (15 min) and refresh (30 days) tokens in
  httpOnly cookies, sessions in Postgres, single-use rotating refresh tokens. The web app's axios
  instance refreshes silently on a 401 and queues concurrent requests meanwhile.
- **Projects** — owned by a user; collaborators are invited by email. Every project route checks
  owner/collaborator access on the server.
- **Canvas** — the live state is a Liveblocks room (room id = project id). The API issues room tokens
  only after a membership check. The editor autosaves snapshots to blob storage; Postgres keeps only
  the reference. An empty room is seeded from the latest snapshot.
- **AI** — `POST /ai/design` and `/ai/spec` trigger Trigger.dev tasks and return `{ runId,
  publicAccessToken }`; the starter's browser follows the run with `useRealtimeRun`. The design task
  asks Gemini for edit operations and applies them to the room server-side (`mutateFlow`), moving an
  AI cursor as it draws. Progress for everyone goes to the room's `ai-status-feed`, replies to
  `ai-chat`. The spec task reads the graph from the room, writes Markdown to blob storage and records
  a `ProjectSpec`. (Emails stay on BullMQ, as in e-commerce.)

See `context/architecture-context.md` for boundaries and invariants.
