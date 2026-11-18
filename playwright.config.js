import { defineConfig, devices } from "@playwright/test";

// Tests run against the built site (_site), served locally.
// They use the system's Microsoft Edge, so no browser download is needed.
// To use Playwright's own Chromium instead: `npx playwright install chromium`
// and set PW_CHANNEL=chromium.
const channel = process.env.PW_CHANNEL || "msedge";
const PORT = 8090;
// Set PW_BASE_URL (e.g. http://localhost:8080) to test an already-running dev server instead of building.
const external = process.env.PW_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: external || `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, grep: /@mobile|@smoke/ },
  ],
  webServer: external ? undefined : {
    command: `npx @11ty/eleventy && npx @11ty/eleventy-dev-server --dir=_site --port=${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
