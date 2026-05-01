import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isSetupComplete } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";
import { UpdateBanner } from "@/components/UpdateBanner";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSetupComplete()) redirect("/setup");
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.07),transparent_34%)]" />

      <Sidebar user={{ email: session.user.email, role: session.user.role }} />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <UpdateBanner />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
