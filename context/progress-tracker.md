# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Turborepo rebuild (2026-10-07): Ghost AI ported from a single Next.js app (`~/Code/learning_project_1`)
  into a pnpm + Turborepo monorepo modelled on `~/Code/e-commerce`. All 29 feature specs are
  implemented and **verified (phase 13 done)**: install, contract emit, typecheck, lint (0 errors) and
  production build pass; the migration applies to a fresh Postgres; the API and the UI were exercised
  end to end locally (auth, project CRUD, owner/collaborator access, canvas save/load, Liveblocks
  auth + realtime room, templates, share dialog, AI sidebar, autosave).

## Current Goal

- Deploy. Remaining work is configuration, not code: set the empty secrets (see Deploy checklist),
  apply the migration to the production database, deploy the Trigger.dev tasks.
- Not yet exercised against live services: AI design / spec generation (needs `TRIGGER_SECRET_KEY`,
  `TRIGGER_PROJECT_REF`, `GOOGLE_GENERATIVE_AI_API_KEY`), emails (needs `RESEND_API_KEY`), Google sign-in.

## Deploy checklist

- Server env that must be real in production: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (rotate
  the dev values), `LIVEBLOCKS_SECRET_KEY`, `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`,
  `GOOGLE_GENERATIVE_AI_API_KEY`, `RESEND_API_KEY` (login requires a verified email), `BLOB_READ_WRITE_TOKEN`
  (without it canvas/specs go to local disk and are lost on redeploy), Redis hosts, `CORS_ORIGIN`/`CLIENT_URL`.
- Web env: `NEXT_PUBLIC_API_URL` (build-time), optional `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Apply the schema: `pnpm --filter server db:apply` (the generated `apps/server/migrations/` is committed state).
- Run two server processes: `start` (API) and `start:worker` (email queue). Deploy tasks with `pnpm --filter server trigger:deploy`
  and set the server env vars in the Trigger.dev dashboard too.
- Redis: `.env` points at the hosted instance shared with e-commerce. The email queue is named `ghost-ai-email-queue`
  so the two apps never consume each other's jobs; rate-limit counters and `cache:*` keys are still shared. Prefer a
  dedicated Redis for production, and confirm the queue instance is `noeviction`.
- Blob: leave `BLOB_READ_WRITE_TOKEN` empty locally (uses `.storage/`); production needs a **private** Vercel Blob store token,
  set on the server and in the Trigger.dev dashboard.
- Cookies are `sameSite: strict`: serve web and API from the same site (`app.x.com` + `api.x.com`).
- Build order matters: `@repo/types` must be built before `web` / `server` typecheck or build (turbo does this).

## Feature specs → rebuild

The specs in `feature-specs/` were written for the original Next.js + Clerk + Trigger.dev + Vercel
Blob app. In this monorepo they are implemented with the agreed substitutions (Clerk → e-commerce
auth; Trigger.dev kept for AI, BullMQ for email):

| Spec(s) | Implemented as |
| --- | --- |
| 01 design system | `apps/web/src/app/globals.css` tokens + shadcn `components/ui` (token names now match ui-context) |
| 02, 04, 07, 08 editor chrome, dialogs, home, workspace shell | `components/editor/*`, `store/editor.store.ts`, `hooks/project/*` |
| 03 auth (Clerk) | e-commerce auth: `apps/server` auth/session routes, `apps/web` auth pages, AuthLoader + route guards |
| 05 Prisma | `apps/server/src/prisma/contract.prisma` (Prisma 8) |
| 06 project APIs | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` |
| 09 share dialog | `/projects/:id/collaborators` + `ShareDialog` (names/avatars from local users, not Clerk) |
| 10 Liveblocks setup | `POST /liveblocks/auth` (access tokens after membership check), `src/liveblocks.config.ts` |
| 11–17 canvas, shapes, nodes, edges, colours, controls | `components/editor/canvas/*`, `hooks/editor/useKeyboardShortcuts.ts` |
| 18 starter templates | `canvas/starter-templates.ts`, `StarterTemplatesModal` |
| 19 presence + cursors | `RoomPresence`, `CollaboratorCursor` via Liveblocks `<Cursors>` |
| 20, 24, 25, 26 AI sidebar, status, chat | `components/editor/ai/*`, Liveblocks feeds `ai-chat` / `ai-status-feed`, `useRealtimeRun` (`RunWatcher`) |
| 21 autosave | `PUT/GET /projects/:id/canvas`, `useCanvasAutosave`, Save button |
| 22, 23 design agent | Trigger.dev task `design-agent`, Gemini edit operations applied with `mutateFlow`; `POST /ai/runs/:runId/token` |
| 27, 28 spec generation + persistence | Trigger.dev task `generate-spec`, blob storage + `ProjectSpec`, download route |
| 29 spec UI | Specs tab, `SpecPreviewModal` (rendered Markdown), downloads through the API |

## Fixed during verification (2026-10-07)

- `next build` failed: `web` aliased `@repo/types` to its TS source while the package is `"type": "commonjs"`.
  Removed the alias + `transpilePackages`; web now consumes the built `dist` like e-commerce (`turbo dev` now builds deps first).
- Server typecheck: pinned `@types/pg` to 8.20.4 (duplicate versions broke `orm-postgres`), removed the
  unsupported `publicTokenOptions` Trigger option, typed rows with `Omit<Model, relations>`.
- `text-base` was both a font size and the `base` colour token: Tailwind emitted `color: var(--bg-base)`
  only, so `text-base` text was near-black (Share dialog title was nearly invisible). Font-size uses are now
  `text-[1rem]`; colour uses are `text-primary-foreground`. Never use `text-base` / `bg-base`-style names as font sizes.
- Floating panels (AI sidebar, minimap) lifted clear of Liveblocks' fixed "Powered by" badge; five off-scale radii moved to `rounded-xl`.

## Fixed while porting

- AI sidebar was rendered outside the Liveblocks room, so its realtime hooks could not work.
- Design requests sent `projectId: "active"`; runs now always use the open room id.
- Liveblocks ID tokens granted room access only to the owner; access tokens now follow project membership.
- Two cursor layers were drawn (one ignored pan/zoom); only Liveblocks `<Cursors>` remains.
- Chat/status were one-off broadcasts lost on reload; they are now persistent Liveblocks feeds.
- `globals.css` mapped tokens to names the components didn't use (`text-copy-primary`, `border-surface-border`, `text-brand` had no styles).
- AI edges put labels at the wrong key and relied on a client-only marker enum.

## Open Questions

- Which database to use (fresh Neon branch or local docker Postgres). Nothing has been applied anywhere.
- Production hosting: cookies are `sameSite: strict`, so web and API must share a site (e.g.
  `app.example.com` + `api.example.com`) or the web app must proxy the API.

## Architecture Decisions

- Next.js stays as the web framework (user's choice); routing is Next's App Router, data is TanStack
  Query — TanStack Router was deliberately not added.
- Trigger.dev runs the AI tasks (switched back from BullMQ on 2026-10-07 at the user's request):
  managed durable runs, retries, and realtime run status in the browser without operating workers.
  BullMQ stays for email, matching e-commerce.
- Prisma 8's contract API, matching `e-commerce/apps/backends/postgres` so its auth code copies across.
- Room id = project id (uuid). Slugs are display-only.
