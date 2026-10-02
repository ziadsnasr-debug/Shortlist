import type { Metadata } from "next";
import { WorkspaceApp } from "@/components/workspace";
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

export default function Page() {
  return <WorkspaceApp />;
}
