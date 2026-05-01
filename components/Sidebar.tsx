"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Globe, Layers, BarChart3, Settings, LogOut, KeyRound, History } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/groups", label: "Gruppen", icon: Layers },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/audit", label: "Audit-Log", icon: History },
  { href: "/settings", label: "Einstellungen", icon: Settings },
  { href: "/settings/api-tokens", label: "API-Tokens", icon: KeyRound },
];

export function Sidebar({ user }: { user: { email: string } }) {
  const pathname = usePathname();
  return (
    <aside className="relative z-10 flex w-60 shrink-0 flex-col border-r border-zinc-800/70 bg-zinc-950/80 backdrop-blur">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800/70 px-5">
        <Logo size={32} />
        <div>
          <p className="text-xs font-semibold tracking-tight text-zinc-100">NexRedirect</p>
          <p className="text-[10px] text-muted-foreground">CoreX</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-zinc-800/70 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800/70 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-cyan-400">
            {user.email[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-200">{user.email}</p>
            <p className="truncate text-[10px] text-zinc-500">Admin</p>
          </div>
          <Link href="/api/auth/signout" className="rounded p-1 text-zinc-600 hover:text-zinc-300" title="Abmelden">
            <LogOut className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
