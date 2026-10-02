import { Alert, AlertDescription } from "@/components/ui/alert";
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Alert>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
export function Panel({ children }: { children: React.ReactNode }) {
  return <section className="panel">{children}</section>;
}
