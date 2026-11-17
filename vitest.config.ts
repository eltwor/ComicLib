// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      COMICVINE_API_KEY: "test-key",
    },
  },
});
