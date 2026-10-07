# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component or route.
- Respect the system boundaries defined in `architecture-context.md`.

## TypeScript

- Strict mode is required throughout the project.
- Avoid `any`; use explicit interfaces or narrowly scoped types.
- Validate unknown external input at system boundaries before trusting it.
- Use `interface` for object contracts.

## Web app (Next.js)

- Pages and editor components are client components: the app talks to a separate API with cookie
  auth, so data is fetched in the browser through TanStack Query, not in server components.
- One hook per operation in `src/hooks/<domain>/`, wrapping a function from `src/api/<domain>.ts`.
- All HTTP goes through `src/lib/api.ts`; read `error.message` / `error.code` (`ApiError`), never the raw Axios error.
- Zustand holds UI/session state only; never copy server data into a store.
- Validate forms with the shared `@repo/types` schemas before sending.

## API (Express)

- Route → controller → service. Controllers are wrapped in `catchError`, parse input with a
  `@repo/types` schema, call one service, and respond with `ok(...)`.
- Services fail fast with `appAssert(condition, status, message)`; they never touch `req`/`res`.
- Long-running AI work belongs in a Trigger.dev task (`src/trigger/`), not a request handler.

## Styling

- Use CSS custom property tokens defined in `globals.css` — no raw Tailwind color classes like `zinc-*` or hardcoded hex values.
- Reference tokens through their Tailwind utility names: `bg-base`, `text-copy-primary`, `border-surface-border`, `text-brand`, etc.
- Maintain the border radius scale: `rounded-xl` for small elements, `rounded-2xl` for cards, `rounded-3xl` for modals.

## API Routes

- Validate and parse request input before any logic runs.
- Enforce auth and project access (`assertProjectAccess` / `assertProjectOwner`) before any read or mutation.
- Return the `{ status, data, meta?, errors? }` envelope.
- Keep handlers thin — push complexity into services or jobs.

## Data and Storage

- Project metadata and relationships belong in PostgreSQL via Prisma.
- Canvas snapshots and generated specs belong in blob storage (`utils/storage`); Prisma stores only the reference.
- Do not store large generated content directly in the database.
- Task run records are first-class relational data — treat ownership and run IDs as verified before any token issuance.

## File Organization

- `apps/server/src/{routes,controllers,services}` — the request path, one file per domain.
- `apps/server/src/jobs/` — queues, producers, processors, workers.
- `apps/server/src/utils/` — shared infrastructure (auth, errors, cache, rate limiter, storage, ai, liveblocks).
- `apps/web/src/{api,hooks,store,components,types}` — client layers, mirroring the e-commerce client.
- `packages/types/` — shared schemas.
- Name files after the responsibility they contain, not the technology.
