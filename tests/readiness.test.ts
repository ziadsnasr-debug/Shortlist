import { beforeEach, describe, expect, it, vi } from "vitest";
import { readiness } from "../lib/readiness";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ owner: vi.fn() }));
vi.mock("../lib/store", () => ({ owner: auth.owner }));

import { GET } from "../app/api/readiness/route";
import { WorkflowError } from "../lib/workflow";

const hostedEnv: Record<string, string | undefined> = {
  APP_ENV: "staging",
  APP_URL: "https://shortlist.example",
  PERSISTENCE_MODE: "supabase-synthetic",
  NEXT_PUBLIC_SUPABASE_URL: "https://db.example",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
  SUPABASE_SERVICE_ROLE_KEY: "private-key",
  WORKSPACE_ID: "workspace-id",
  AI_ENABLED: "true",
  OPENAI_API_KEY: "provider-key",
  AI_MODEL_ID: "synthetic-model",
  PARSER_SNAPSHOT_ID: "snapshot-id",
  PARSER_BUNDLE_SHA256: "a".repeat(64),
  CRON_SECRET: "c".repeat(32),
  MONTHLY_PROCESSING_ALLOWANCE: "240",
  REAL_CV_DATA_ENABLED: "false",
};

describe("configuration readiness", () => {
  it("checks active public-pilot configuration without exposing its actor or expiry", () => {
    const temporary = {
      ...hostedEnv,
      TEMP_PUBLIC_ACCESS: "true",
      TEMP_PUBLIC_ACCESS_UNTIL: "2099-01-01T00:00:00Z",
      TEMP_PUBLIC_ACTOR_ID: "11111111-1111-4111-8111-111111111111",
    };
    expect(readiness(temporary).status).toBe("configuration_ready");
    for (const override of [
      { TEMP_PUBLIC_ACCESS_UNTIL: "invalid" },
      { TEMP_PUBLIC_ACTOR_ID: "invalid" },
      { REAL_CV_DATA_ENABLED: undefined },
      { PERSISTENCE_MODE: "local-synthetic" },
    ]) {
      const report = readiness({ ...temporary, ...override });
      expect(report.status).toBe("blocked");
      expect(report.checks.find(c => c.name === "temporary_public_access_configuration")?.status).toBe("fail");
      expect(JSON.stringify(report)).not.toContain(temporary.TEMP_PUBLIC_ACTOR_ID);
      expect(JSON.stringify(report)).not.toContain(temporary.TEMP_PUBLIC_ACCESS_UNTIL);
    }
  });
  it("allows an expired fictional pilot to revert to authentication", () => {
    expect(readiness({
      ...hostedEnv,
      TEMP_PUBLIC_ACCESS: "true",
      TEMP_PUBLIC_ACCESS_UNTIL: "2000-01-01T00:00:00Z",
    }).status).toBe("configuration_ready");
  });
  it("blocks a local login bypass flag in hosted configuration", () => {
    const report = readiness({ ...hostedEnv, LOCAL_AUTH_BYPASS: "true" });
    expect(report.status).toBe("blocked");
    expect(
      report.checks.find((c) => c.name === "local_authentication_configuration")
        ?.status,
    ).toBe("fail");
  });
  it("blocks missing hosted configuration without exposing values", () => {
    const report = readiness({
      APP_ENV: "staging",
      PERSISTENCE_MODE: "supabase-synthetic",
    });
    expect(report.status).toBe("blocked");
    expect(
      report.checks.find((check) => check.name === "supabase_configuration")
        ?.status,
    ).toBe("fail");
    expect(JSON.stringify(report)).not.toMatch(/key|secret|https?:\/\//i);
  });

  it("blocks loopback Supabase endpoints in a hosted environment", () => {
    const report = readiness({
      ...hostedEnv,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });
    expect(
      report.checks.find((check) => check.name === "supabase_configuration")
        ?.status,
    ).toBe("fail");
  });

  it("accepts only exact environment names and origins", () => {
    const report = readiness({
      ...hostedEnv,
      APP_ENV: "Production",
      APP_URL: "https://shortlist.example/",
    });
    expect(
      report.checks.find((check) => check.name === "app_environment")?.status,
    ).toBe("fail");
    expect(
      report.checks.find((check) => check.name === "application_origin")
        ?.status,
    ).toBe("fail");
  });

  it("accepts a local loopback origin and skips hosted-only services", () => {
    const report = readiness({
      APP_ENV: "local",
      APP_URL: "http://127.0.0.1:3218",
      PERSISTENCE_MODE: "local-synthetic",
      MONTHLY_PROCESSING_ALLOWANCE: "240",
      REAL_CV_DATA_ENABLED: "false",
    });
    expect(report.status).toBe("configuration_ready");
    expect(
      report.checks.find((check) => check.name === "application_origin")
        ?.status,
    ).toBe("pass");
    expect(
      report.checks.find(
        (check) => check.name === "parser_snapshot_configuration",
      )?.status,
    ).toBe("not_applicable");
  });

  it("accepts the configured local Supabase backend over loopback", () => {
    const report = readiness({
      APP_ENV: "local",
      APP_URL: "http://127.0.0.1:3218",
      PERSISTENCE_MODE: "supabase-synthetic",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "local-private-key",
      WORKSPACE_ID: "workspace-id",
      PARSER_SNAPSHOT_ID: "local-snapshot",
      PARSER_BUNDLE_SHA256: "b".repeat(64),
      MONTHLY_PROCESSING_ALLOWANCE: "240",
      REAL_CV_DATA_ENABLED: "false",
    });
    expect(report.status).toBe("configuration_ready");
    expect(
      report.checks.find((check) => check.name === "supabase_configuration")
        ?.status,
    ).toBe("pass");
  });

  it("requires a pinned parser snapshot and hash for local Supabase persistence", () => {
    const report = readiness({
      APP_ENV: "local",
      APP_URL: "http://127.0.0.1:3218",
      PERSISTENCE_MODE: "supabase-synthetic",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "local-private-key",
      WORKSPACE_ID: "workspace-id",
      REAL_CV_DATA_ENABLED: "false",
    });
    expect(
      report.checks.find(
        (check) => check.name === "parser_snapshot_configuration",
      )?.status,
    ).toBe("fail");
  });

  it.each(["0", "-1", "1.5", "1001", "not-a-number"])(
    "blocks invalid processing allowance %s",
    (allowance) => {
      const report = readiness({
        ...hostedEnv,
        MONTHLY_PROCESSING_ALLOWANCE: allowance,
      });
      expect(
        report.checks.find((check) => check.name === "monthly_allowance")
          ?.status,
      ).toBe("fail");
    },
  );

  it("always blocks real-data activation", () => {
    const report = readiness({ ...hostedEnv, REAL_CV_DATA_ENABLED: "true" });
    expect(report.status).toBe("blocked");
    expect(
      report.checks.find((check) => check.name === "real_data_disabled")
        ?.status,
    ).toBe("fail");
  });
});

describe("authenticated readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies reviewers and keeps responses private", async () => {
    auth.owner.mockResolvedValue({ local: false, role: "reviewer" });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).error).toBe("ACCESS_DENIED");
  });

  it("requires authentication and does not expose the underlying auth error", async () => {
    auth.owner.mockRejectedValue(
      new WorkflowError("Sign in with your invited account.", 401),
    );
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("invited account");
  });

  it("denies an outsider without revealing membership details", async () => {
    auth.owner.mockRejectedValue(
      new WorkflowError("Workspace access denied.", 403),
    );
    const response = await GET();
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("Workspace access denied");
  });

  it("returns only named statuses to authenticated administrators", async () => {
    auth.owner.mockResolvedValue({ local: false, role: "administrator" });
    const keys = Object.keys(hostedEnv);
    const prior = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    try {
      Object.assign(process.env, hostedEnv);
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(body.status).toBe("configuration_ready");
      expect(
        body.checks.every((check: unknown) => {
          const fields = Object.keys(check as object).sort();
          return fields.join(",") === "name,status";
        }),
      ).toBe(true);
      expect(JSON.stringify(body)).not.toMatch(
        /private-key|provider-key|https?:\/\//,
      );
    } finally {
      for (const key of keys) {
        if (prior[key] === undefined) delete process.env[key];
        else process.env[key] = prior[key];
      }
    }
  });
});
