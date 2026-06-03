import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000, // the fit-score wizard flow is long (smooth-scroll between ~8 steps); 15s was too tight under parallel load
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "python3 -m http.server 8080",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
