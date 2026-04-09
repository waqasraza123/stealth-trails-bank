import { defineConfig } from "@playwright/test";

const webUrl = "http://127.0.0.1:4173";
const adminUrl = "http://127.0.0.1:4174";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm --filter @stealth-trails-bank/web exec vite --host 127.0.0.1 --port 4173",
      url: webUrl,
      reuseExistingServer: true,
      stdout: "pipe",
      stderr: "pipe"
    },
    {
      command:
        "pnpm --filter @stealth-trails-bank/admin exec vite --host 127.0.0.1 --port 4174",
      url: adminUrl,
      reuseExistingServer: true,
      stdout: "pipe",
      stderr: "pipe"
    }
  ]
});
