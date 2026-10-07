import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { connectDB, closeDB } from "./config/db";
import { emailWorker } from "./jobs/workers/email.worker";

/** Stops the queue workers from taking new jobs and waits for the ones in flight. */
export const closeWorkers = async () => {
  await Promise.all([
    emailWorker.close(),
  ]);
};

async function startWorker() {
  await connectDB();
  console.log("🚀 Background Worker Process Initialized (Email Worker Active)");
}

/*
  This module is imported by the API (index.ts) so one process can serve requests and run jobs, and
  is also started on its own via `pnpm worker`. Only the standalone process connects the database
  and owns the signal handlers: registering them here unconditionally meant that in the API process
  a SIGTERM exited as soon as the workers closed, killing in-flight HTTP requests — possibly
  mid-transaction. When imported, index.ts drives shutdown and calls closeWorkers() itself.
 */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  startWorker().catch((err) => {
    console.error("Failed to start worker process:", err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Closing background workers gracefully...`);
    await closeWorkers();
    await closeDB();
    console.log("Background worker shutdown complete.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
