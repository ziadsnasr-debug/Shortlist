import { expect, it, vi } from "vitest";
import { temporaryPublicActor } from "../lib/temporary-access";
vi.mock("server-only", () => ({}));
import { administrator } from "../lib/administration";
const env = {
  TEMP_PUBLIC_ACCESS: "true", TEMP_PUBLIC_ACTOR_ID: "11111111-1111-4111-8111-111111111111",
  TEMP_PUBLIC_ACCESS_UNTIL: "2026-10-03T12:00:00Z",
  PERSISTENCE_MODE: "supabase-synthetic", REAL_CV_DATA_ENABLED: "false",
};
it("requires explicit opt-in and expires back to authentication", () => {
  expect(temporaryPublicActor({}, 0)).toBeUndefined();
  expect(temporaryPublicActor(env, 0)).toBe(env.TEMP_PUBLIC_ACTOR_ID);
  expect(temporaryPublicActor(env, Date.parse(env.TEMP_PUBLIC_ACCESS_UNTIL))).toBeUndefined();
});
it("rejects real data, missing expiry and invalid actor", () => {
  for (const override of [{REAL_CV_DATA_ENABLED:"true"}, {REAL_CV_DATA_ENABLED:undefined}, {TEMP_PUBLIC_ACCESS_UNTIL:""}, {TEMP_PUBLIC_ACTOR_ID:"invalid"}])
    expect(() => temporaryPublicActor({...env,...override}, 0)).toThrow();
});
it("denies account administration to public pilot access", () => {
  expect(() => administrator({actor:env.TEMP_PUBLIC_ACTOR_ID,workspaceId:"test",role:"administrator",local:false,temporaryPublic:true})).toThrow("Account administration is unavailable");
});
it("ends the extended pilot at Tuesday 17:00 London time on the request clock", () => {
  const extended = { ...env, TEMP_PUBLIC_ACCESS_UNTIL: "2026-10-06T16:00:00.000Z" };
  const cutoff = Date.parse(extended.TEMP_PUBLIC_ACCESS_UNTIL);
  expect(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(cutoff)).toBe("Tuesday 17:00");
  vi.useFakeTimers();
  try {
    vi.setSystemTime(cutoff - 1);
    expect(temporaryPublicActor(extended)).toBe(extended.TEMP_PUBLIC_ACTOR_ID);
    vi.setSystemTime(cutoff);
    expect(temporaryPublicActor(extended)).toBeUndefined();
    vi.setSystemTime(cutoff + 1);
    expect(temporaryPublicActor(extended)).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});
