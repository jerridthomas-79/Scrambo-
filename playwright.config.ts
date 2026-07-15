import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173/Scrambo-/",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://127.0.0.1:5173/Scrambo-/",
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile-safari", use: { ...devices["iPhone 14 Pro Max"] } },
    { name: "ipad", use: { ...devices["iPad Pro 11"] } },
  ],
});
