import { expect, it } from "vitest";
import { localBypassActor, localBypassHostAllowed } from "../lib/local-access";
const env = {
  LOCAL_AUTH_BYPASS: "true",
  LOCAL_AUTH_USER_ID: "11111111-1111-4111-8111-111111111111",
  APP_ENV: "local",
  REAL_CV_DATA_ENABLED: "false",
  PERSISTENCE_MODE: "supabase-synthetic",
  APP_URL: "http://127.0.0.1:3218",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421",
};
it("denies missing, foreign or forwarded foreign hosts while bypassing", () => {
  expect(localBypassHostAllowed("127.0.0.1:3218", null, env)).toBe(true);
  expect(localBypassHostAllowed(null, null, env)).toBe(false);
  expect(localBypassHostAllowed("attacker.example:3218", null, env)).toBe(
    false,
  );
  expect(
    localBypassHostAllowed("127.0.0.1:3218", "attacker.example", env),
  ).toBe(false);
  expect(localBypassHostAllowed("127.0.0.1:3217", null, env)).toBe(false);
});
it("uses only the explicitly configured local actor", () => {
  expect(localBypassActor(env)).toBe(env.LOCAL_AUTH_USER_ID);
  expect(
    localBypassActor({ ...env, LOCAL_AUTH_BYPASS: "false" }),
  ).toBeUndefined();
});
it.each([
  { VERCEL: "1" },
  { APP_ENV: "production" },
  { APP_ENV: "staging" },
  { REAL_CV_DATA_ENABLED: "true" },
  { PERSISTENCE_MODE: "local-synthetic" },
  { APP_URL: "https://shortlist.example.com" },
  { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
  { APP_URL: "http://127.0.0.1.evil.example" },
  { LOCAL_AUTH_USER_ID: "" },
])("refuses unsafe or incomplete bypass configuration %j", (override) => {
  expect(() => localBypassActor({ ...env, ...override })).toThrow();
});
