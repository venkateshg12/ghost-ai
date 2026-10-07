# Architecture Context

## Stack

| Layer            | Technology                                   | Role                                                          |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Monorepo         | pnpm workspaces + Turborepo                  | `apps/server`, `apps/web`, shared `packages/*`                |
| Web app          | Next.js 16 (App Router) + TypeScript         | Client UI; talks to the API over HTTP with cookie auth        |
| Client data      | TanStack Query + Zustand + axios             | Server state / UI state / single HTTP client with refresh     |
| UI               | Tailwind v4 + shadcn/ui                      | Component composition and styling                             |
| API              | Express 5 + TypeScript                       | Auth, projects, collaborators, canvas, specs, AI runs         |
| Auth             | JWT access/refresh cookies + Postgres sessions (+ Google) | User identity and route protection               |
| Database         | Prisma 8 (contract API) + PostgreSQL         | Users, sessions, projects, collaborators, specs, task runs    |
| Canvas           | Liveblocks + React Flow                      | Real-time collaborative canvas, presence, cursors, feeds      |
| Background jobs  | Trigger.dev (AI) + BullMQ/Redis (email)      | Durable AI design/spec runs with realtime status; email jobs  |
| AI               | Gemini via the AI SDK (`@ai-sdk/google`)     | Design operations and Markdown specs                          |
| Artifact storage | Vercel Blob (private), local disk in dev     | Canvas snapshots and generated Markdown specs                 |
| Cache / limits   | Redis (separate cache instance)              | Session cache, member-list cache, rate limiting               |

## System Boundaries

- `apps/server/src/routes` → `controllers` → `services` — strict layering. Controllers validate input
  with `@repo/types` and shape responses; services hold logic and queries; neither skips a layer.
- `apps/server/src/trigger` — Trigger.dev tasks (`design-agent`, `generate-spec`), triggered by services.
- `apps/server/src/jobs` — BullMQ email jobs: queues, producers (called by services), processors.
- `apps/server/src/utils` — shared infrastructure: auth, errors, envelope, cache, rate limiter,
  storage, Liveblocks client, AI helpers.
- `apps/server/src/prisma` — the data contract and the `orm` client.
- `apps/web/src/api` + `hooks` — the only way the web app reads or writes server data.
- `apps/web/src/components` — UI composition only; no business rules.
- `packages/types` — every schema both sides validate against.

## Storage Model

- **Postgres**: metadata, ownership, relationships, sessions, task runs.
- **Blob storage**: canvas snapshots at `canvas/{projectId}.json` and specs at
  `specs/{projectId}/{specId}.md`, stored **private**. Postgres keeps only the reference
  (`Project.canvasJsonPath`, `ProjectSpec.filePath`). Content is only ever served through
  access-checked API routes.
- **Liveblocks room** (id = project id): the live canvas (`flow` storage key), presence, and two
  feeds — `ai-chat` (conversation) and `ai-status-feed` (AI progress).
- **Redis**: BullMQ email queue + rate-limiter counters (`noeviction` instance) and the cache
  (`volatile-lru` instance).

## Auth and Collaboration Model

- Every project has one owner (a user id). Collaborators are invited by email and get access once an
  account with that email exists.
- Only authenticated users reach any project route; `assertProjectAccess` (owner or collaborator) and
  `assertProjectOwner` (rename, delete, manage collaborators) guard every service call.
- Liveblocks access tokens are issued by `POST /liveblocks/auth` only after the membership check.
- AI runs are readable only by the user who started them: the trigger call returns a token scoped to
  that one run, and `POST /ai/runs/:runId/token` re-issues one only for the `TaskRun.userId`.

## Starter System Designs

- Prebuilt templates are static canvas snapshots in `apps/web/src/components/editor/canvas/starter-templates.ts`.
- Importing replaces the room's nodes and edges through the collaborative flow state.
- Template data uses the same node/edge shape as user and AI content.

## AI Generation Model

### Design generation

- Input: prompt + the room's current graph (read server-side).
- Execution: Trigger.dev task `design-agent` (status to the starter via `useRealtimeRun`).
- Output: edit operations (add/update/move/resize/delete node, add/delete edge), validated and
  applied to the room with `mutateFlow`; AI presence (cursor + thinking) while it runs; status in
  `ai-status-feed`; a summary reply in `ai-chat`.

### Spec generation

- Input: the room's current graph (read server-side) + recent chat.
- Execution: Trigger.dev task `generate-spec`.
- Output: Markdown in blob storage, a `ProjectSpec` row, status + chat notification.

## Invariants

1. Request handlers never run model calls — they trigger a task and return a run id + run-scoped token.
2. Metadata (Postgres) and large artifacts (blob storage) are stored in separate layers.
3. Auth and project access are enforced on the server at every read and mutation.
4. The graph an AI job uses comes from the room, never from the client.
5. User-created, template and AI-created canvas content share one node/edge schema.
