import { redirect } from "next/navigation";
import Login from "@/components/login";
import { localBypassActor } from "@/lib/local-access";
export default function LoginPage() {
  if (localBypassActor()) redirect("/");
  return <Login />;
}
