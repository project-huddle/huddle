import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    { command: "bun run start", cwd: "../server", url: "http://127.0.0.1:3000/health", reuseExistingServer: !process.env.CI, timeout: 30_000 },
    { command: "bun run dev -- --host 127.0.0.1", cwd: ".", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI, timeout: 30_000, env: { VITE_API_URL: "http://127.0.0.1:3000" } },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], permissions: ["microphone", "camera"] } }],
})
