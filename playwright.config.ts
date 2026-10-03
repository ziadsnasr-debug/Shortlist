import { defineConfig } from "@playwright/test";
import { origin, port } from "./tests/e2e/origin";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: origin,
    browserName: "chromium",
    screenshot: "only-on-failure",
    // CI uploads test-results on failure; the trace shows why an action waited.
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- --port ${port}`,
    env: {
      PERSISTENCE_MODE: "local-synthetic",
      LOCAL_AUTH_BYPASS: "false",
      APP_URL: origin,
      AI_ENABLED: "false",
    },
    url: origin,
    reuseExistingServer: false,
  },
  reporter: "list",
});
