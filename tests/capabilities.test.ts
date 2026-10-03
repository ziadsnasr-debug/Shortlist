import { describe, expect, it } from "vitest";
import { navCapabilities } from "../components/workflow/capabilities";

describe("navCapabilities", () => {
  it("lets administrators create and administer in a signed-in workspace", () => {
    expect(navCapabilities({ role: "administrator" })).toEqual({
      canCreate: true,
      canAdminister: true,
    });
  });
  it("keeps creation but hides administration in the open pilot", () => {
    expect(
      navCapabilities({ role: "administrator", temporaryPublic: true }),
    ).toEqual({ canCreate: true, canAdminister: false });
  });
  it("offers neither to reviewers or before state loads", () => {
    const none = { canCreate: false, canAdminister: false };
    expect(navCapabilities({ role: "reviewer" })).toEqual(none);
    expect(navCapabilities(undefined)).toEqual(none);
  });
});
