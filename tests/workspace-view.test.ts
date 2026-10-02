import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { workspaceView } from "@/lib/workspace-view";
import { seed } from "@/fixtures/synthetic/seed";

const reviewer = {
  actor: "fictional-reviewer",
  workspaceId: "w1",
  role: "reviewer" as const,
  local: false,
};

describe("workspace view", () => {
  it("carries role, mode and capabilities without the audit log", () => {
    const view = workspaceView(reviewer, seed());
    expect(view.role).toBe("reviewer");
    expect(view.mode).toBe("Supabase synthetic");
    expect(view.temporaryPublic).toBe(false);
    expect(view.capabilities).toEqual({ uploads: false, ai: false });
    expect(view.audit).toBeUndefined();
  });

  it("labels local and temporary public access", () => {
    expect(workspaceView({ ...reviewer, local: true }, seed()).mode).toBe(
      "Local synthetic",
    );
    expect(
      workspaceView({ ...reviewer, temporaryPublic: true }, seed()).mode,
    ).toBe("Temporary public synthetic");
  });

  it("never exposes names unless revealed after every review", () => {
    const state = seed();
    const names = state.vacancies
      .flatMap((v) => v.batches)
      .flatMap((b) => b.applications)
      .map((a) => a.name)
      .filter(Boolean);
    const json = JSON.stringify(workspaceView(reviewer, state));
    for (const name of names) expect(json).not.toContain(name);
  });
});
