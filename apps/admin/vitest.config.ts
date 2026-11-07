import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: { alias: { "@": path.join(currentDir, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.interaction.test.tsx"],
    clearMocks: true,
    // Samsung Termux has limited memory/CPU; avoid jsdom test-file contention.
    maxWorkers: 1,
    testTimeout: 12000,
  },
})
