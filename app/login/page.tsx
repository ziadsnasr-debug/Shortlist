import { redirect } from "next/navigation";
import Login from "@/components/login";
import { localBypassActor } from "@/lib/local-access";
import { temporaryPublicActor } from "@/lib/temporary-access";
export default function LoginPage() {
  if (temporaryPublicActor() || localBypassActor()) redirect("/");
  return <Login />;
}
