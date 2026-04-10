import { defineConfig } from "@playwright/test";

const webUrl = "http://127.0.0.1:4173";
const adminUrl = "http://127.0.0.1:4174";
const liveWebUrl = process.env.PLAYWRIGHT_LIVE_WEB_URL ?? "http://127.0.0.1:8080";
const liveAdminUrl =
  process.env.PLAYWRIGHT_LIVE_ADMIN_URL ?? "http://127.0.0.1:4174";
const includeLiveSmoke = process.env.PLAYWRIGHT_INCLUDE_LIVE_SMOKE === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "mocked-web",
      testMatch: ["web/**/*.spec.ts"],
      use: {
        baseURL: webUrl
      }
    },
    {
      name: "mocked-admin",
      testMatch: ["admin/**/*.spec.ts"],
      use: {
        baseURL: adminUrl
      }
    },
    {
      name: "live-web-smoke",
      testMatch: ["live/smoke-live-web.spec.ts"],
      grep: includeLiveSmoke ? undefined : /$^/,
      use: {
        baseURL: liveWebUrl
      }
    },
    {
      name: "live-admin-smoke",
      testMatch: ["live/smoke-live-admin.spec.ts"],
      grep: includeLiveSmoke ? undefined : /$^/,
      use: {
        baseURL: liveAdminUrl
      }
    }
  ],
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
