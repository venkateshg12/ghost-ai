# Ghost AI — agent notes

Read these before implementing or making architectural decisions:

1. `context/project-overview.md` — product definition and scope
2. `context/architecture-context.md` — system structure, boundaries, storage model, invariants
3. `context/ui-context.md` — theme tokens, canvas design, component conventions
4. `context/code-standards.md` — implementation rules
5. `context/ai-workflow-rules.md` — workflow and scoping
6. `context/progress-tracker.md` — current state

Update `context/progress-tracker.md` after each meaningful change, and the relevant context file when
architecture, scope or standards change. `tasks/todo.md` holds the current plan.

`apps/web` uses Next.js 16, which has breaking changes from older versions — check
`node_modules/next/dist/docs/` before using an unfamiliar API. `apps/server` uses Prisma 8's contract
API (`orm.Model.where().first()`), not `PrismaClient`.

## Repository layout

- `apps/server` — Express API. Layering is strict: route → controller → service. Controllers are
  wrapped in `catchError`, validate with `@repo/types`, call one service and reply with `ok()`.
  Services use `appAssert`. AI work runs as Trigger.dev tasks in `src/trigger/`; email jobs run on
  BullMQ under `src/jobs/`.
- `apps/web` — Next.js client. Server data through one TanStack Query hook per operation
  (`src/hooks/<domain>/`), wrapping functions in `src/api/<domain>.ts`; UI state in Zustand
  (`src/store/`); all HTTP through `src/lib/api.ts`. Pages are client components guarded by
  `ProtectedRoute` / `PublicRoute`; `AuthLoader` resolves the session first.
- `packages/types` — schemas both sides validate with. Change a request shape here, not locally.

## Commands

```bash
pnpm dev | build | lint | typecheck | test
pnpm --filter server ai:eval   # compare AI providers on benchmark prompts
pnpm --filter server db:plan <name> && pnpm --filter server db:apply   # schema changes
```

## Rules

- Never run model calls in a request handler — trigger a Trigger.dev task.
- Canvas JSON and spec Markdown live in blob storage; Postgres stores only the reference.
- Every project read/mutation goes through `assertProjectAccess` / `assertProjectOwner`.
- Session revocation goes through `revokeSessions` (it clears the 60s session cache).
- Do not run git commands unless the user asks.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
