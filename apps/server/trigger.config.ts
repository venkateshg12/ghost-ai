import { defineConfig } from "@trigger.dev/sdk";

/*
  Trigger.dev runs the AI tasks in src/trigger on its own infrastructure, so model calls never run in
  an API request. `pnpm trigger:dev` runs them locally against this folder's .env; deployed tasks need
  the same variables set in the Trigger.dev dashboard (DATABASE_URL, LIVEBLOCKS_SECRET_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY, BLOB_READ_WRITE_TOKEN, plus the ones constants/env.ts requires).
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_rglguvawhbjtrocebhzd",
  dirs: ["./src/trigger"],
  runtime: "node",
  // A generous ceiling: a large design applies dozens of canvas operations one by one.
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 2000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
