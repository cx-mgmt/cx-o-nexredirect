"use client";
import { useEffect, useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import Link from "next/link";

type VersionInfo = {
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url?: string;
};

export function UpdateBanner() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch("/api/update/check", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setInfo(d); })
        .catch(() => {});
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!info?.update_available || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-cyan-500/30 bg-cyan-500/10 px-6 py-2 text-sm">
      <div className="flex items-center gap-2 text-cyan-300">
        <ArrowUpCircle className="h-4 w-4" />
        <span>
          Update <span className="font-semibold">{info.latest}</span> verfügbar (aktuell {info.current}).
        </span>
        {info.release_url && (
          <Link href={info.release_url} target="_blank" rel="noreferrer" className="underline hover:text-cyan-200">
            Release-Notes
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link href="/settings" className="rounded bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30">
          Jetzt aktualisieren
        </Link>
        <button onClick={() => setDismissed(true)} className="rounded p-1 text-cyan-400/70 hover:text-cyan-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
