import type { Metadata } from "next";
import { WorkspaceApp } from "@/components/workspace";
import { owner, readState } from "@/lib/store";
import { workspaceView } from "@/lib/workspace-view";
import { parsePath } from "@/components/workflow/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
  const { path = [] } = await params;
  const route = parsePath("/" + path.join("/"));
  const titles = {
    home: "Vacancies",
    new: "New vacancy",
    admin: "Administration",
  };
  // Vacancy titles come from the client once the workspace has loaded.
  return {
    title:
      route.view in titles
        ? `${titles[route.view as keyof typeof titles]} · Shortlist`
        : "Shortlist",
  };
}

// Render the first screen with real data so it appears without waiting for a
// client fetch. Anything that needs a cookie write (local demo cookie, token
// refresh) cannot happen during render, so the client fetch remains the
// fallback and the API route handles it as before.
export default async function Page() {
  let initial = null;
  try {
    const access = await owner();
    initial = workspaceView(access, await readState(access));
  } catch {
    initial = null;
  }
  return <WorkspaceApp initial={initial} />;
}
