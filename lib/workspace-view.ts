import "server-only";
import { publicState, type Workspace } from "./workflow";
import type { Owner } from "./store";

// The workspace as a signed-in member may see it. Shared by the API and the
// page's first render so both always send exactly the same data.
export function workspaceView(access: Owner, state: Workspace, reveal = false) {
  return {
    ...publicState(state, reveal),
    role: access.role,
    temporaryPublic: access.temporaryPublic ?? false,
    mode: access.temporaryPublic
      ? "Temporary public synthetic"
      : access.local
        ? "Local synthetic"
        : "Supabase synthetic",
    capabilities: {
      uploads: !access.local && !!process.env.PARSER_SNAPSHOT_ID,
      ai: process.env.AI_ENABLED === "true" && !!process.env.OPENAI_API_KEY,
    },
  };
}
