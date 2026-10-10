import { defineConfig } from "vitest/config";

// Placeholder values so modules that read constants/env.ts can be imported in tests; no test talks to a real service.
export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        env: {
            CORS_ORIGIN: "http://localhost:3000",
            DATABASE_URL: "postgresql://test:test@localhost:5432/test",
            JWT_SECRET: "test-secret-test-secret-test-secret-aaaa",
            JWT_REFRESH_SECRET: "test-refresh-test-refresh-test-refresh-bbbb",
            LIVEBLOCKS_SECRET_KEY: "sk_test",
            TRIGGER_SECRET_KEY: "tr_dev_test",
            PROXY_SHARED_SECRET: "test-proxy-secret-0123456789-abcdef",
            NVIDIA_API_KEY: "",
            GOOGLE_GENERATIVE_AI_API_KEY: "",
        },
    },
});
