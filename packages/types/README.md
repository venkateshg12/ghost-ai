# @repo/types

Zod schemas and inferred types shared by `apps/server` (request validation) and `apps/web` (forms,
API typing, realtime payload validation).

- `user.ts` — auth inputs (register, login, reset, profile, password change)
- `cookie.ts` — the cookie helper contract used by the server
- `project.ts` — project, collaborator and spec inputs/outputs
- `canvas.ts` — node shapes, colour palette, node/edge data and the canvas snapshot schema
- `ai.ts` — AI request bodies, the Liveblocks feed payloads (`ai-chat`, `ai-status-feed`) and run status

The server consumes the CommonJS build in `dist/` (`pnpm --filter @repo/types build`, which `turbo`
runs before every `build`/`typecheck`). The web app compiles `src/` directly through a tsconfig path,
so `next dev` never depends on a stale `dist/`.
