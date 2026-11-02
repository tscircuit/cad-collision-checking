import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./playwright",
  testMatch: "**/*.pw.ts",
  workers: 1,
  use: { browserName: "chromium" },
})
