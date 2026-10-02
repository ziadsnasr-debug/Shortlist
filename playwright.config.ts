import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3217",
    browserName: "chromium",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --port 3217",
    env: {
      PERSISTENCE_MODE: "local-synthetic",
      LOCAL_AUTH_BYPASS: "false",
      APP_URL: "http://127.0.0.1:3217",
      AI_ENABLED: "false",
    },
    url: "http://127.0.0.1:3217",
    reuseExistingServer: false,
  },
  reporter: "list",
});
