import { defineConfig } from "vitest/config";

// Only the sources: never build output such as .next/.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], exclude: ["node_modules/**", ".next/**"] },
});
