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
    url: "http://127.0.0.1:3217",
    reuseExistingServer: false,
  },
  reporter: "list",
});
