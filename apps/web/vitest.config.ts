import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // E2E tests (Playwright) live in e2e/ and use a different runner.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` is a Next.js guard that throws at runtime if a
      // server module is imported in the browser. In the Vitest Node
      // environment it doesn't exist, so we stub it out.
      "server-only": path.resolve(__dirname, "__mocks__/server-only.ts"),
    },
  },
});
