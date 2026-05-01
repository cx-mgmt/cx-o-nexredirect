import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSetupComplete()) redirect("/setup");
  return <>{children}</>;
}
