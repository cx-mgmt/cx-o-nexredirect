import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSetupComplete } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!isSetupComplete()) redirect("/setup");
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  redirect("/dashboard");
}
