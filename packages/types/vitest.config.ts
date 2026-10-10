import { defineConfig } from "vitest/config";

// Only the TypeScript sources: the build output in dist/ must never be collected as tests.
export default defineConfig({
    test: { include: ["src/**/*.test.ts"], exclude: ["dist/**", "node_modules/**"] },
});
