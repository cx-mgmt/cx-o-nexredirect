import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSetupComplete } from "@/lib/db";

export default async function RootPage() {
  if (!isSetupComplete()) redirect("/setup");
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  redirect("/dashboard");
}
