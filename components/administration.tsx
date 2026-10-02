"use client";
import { Database, SlidersHorizontal, Users, Workflow } from "lucide-react";
import { ControlsTab } from "./admin/controls";
import { DataTab } from "./admin/data";
import { MembersTab } from "./admin/members";
import { ProcessingTab } from "./admin/processing";
import { AdminSkeleton, AdminUnavailable } from "./admin/states";
import { useAdmin } from "./admin/use-admin";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export type { Admin } from "./admin/types";

const panel = "data-[state=inactive]:hidden";

export function Administration() {
  const a = useAdmin();
  const { data } = a;
  return (
    <section className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-1">
      <h1 id="page-title" tabIndex={-1}>
        Administration
      </h1>
      <p className="max-w-prose">
        Manage who can use this workspace, pause or resume processing, and
        remove application content.
      </p>
      {a.load === "loading" && <AdminSkeleton />}
      {a.load === "unavailable" && (
        <AdminUnavailable reason={a.reason} onRetry={a.retry} />
      )}
      {a.load === "ready" && data && (
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5">
          <div role="status" className="empty:hidden text-sm">
            {a.notice}
          </div>
          {a.error && (
            <Alert variant="destructive">
              <AlertDescription>{a.error}</AlertDescription>
            </Alert>
          )}
          <Tabs defaultValue="members">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="members">
                <Users aria-hidden="true" className="size-4" />
                Members
              </TabsTrigger>
              <TabsTrigger value="controls">
                <SlidersHorizontal aria-hidden="true" className="size-4" />
                Controls
              </TabsTrigger>
              <TabsTrigger value="processing">
                <Workflow aria-hidden="true" className="size-4" />
                Processing
              </TabsTrigger>
              <TabsTrigger value="data">
                <Database aria-hidden="true" className="size-4" />
                Data
              </TabsTrigger>
            </TabsList>
            <TabsContent value="members" forceMount className={panel}>
              <MembersTab members={data.members} busy={a.busy} send={a.send} />
            </TabsContent>
            <TabsContent value="controls" forceMount className={panel}>
              <ControlsTab
                settings={data.settings}
                busy={a.busy}
                send={a.send}
              />
            </TabsContent>
            <TabsContent value="processing" forceMount className={panel}>
              <ProcessingTab
                documents={data.documents}
                summary={data.processing}
                paused={data.settings.paused}
                busy={a.busy}
                send={a.send}
                refresh={a.refresh}
              />
            </TabsContent>
            <TabsContent value="data" forceMount className={panel}>
              <DataTab
                pending={data.deletions.filter((d) => !d.completed_at).length}
                earliest={
                  data.deletions
                    .filter((d) => !d.completed_at && d.ready_after)
                    .map((d) => d.ready_after!)
                    .sort()[0]
                }
                busy={a.busy}
                deleteContent={a.deleteContent}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </section>
  );
}
