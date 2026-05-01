"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Strength = { ok: boolean; reason?: string; checking?: boolean };

export function PasswordField({
  value, onChange, onValidationChange, label = "Passwort", id = "password", autoComplete = "new-password", disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onValidationChange?: (v: Strength) => void;
  label?: string;
  id?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [strength, setStrength] = useState<Strength>({ ok: false });

  useEffect(() => {
    if (!value) { setStrength({ ok: false }); onValidationChange?.({ ok: false }); return; }
    setStrength((s) => ({ ...s, checking: true }));
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/password-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: value }) });
        const d = await r.json();
        const next: Strength = { ok: !!d.ok, reason: d.reason };
        setStrength(next);
        onValidationChange?.(next);
      } catch {
        setStrength({ ok: false, reason: "Prüfung nicht möglich." });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, onValidationChange]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200" tabIndex={-1}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {value && (
        <div className="flex items-start gap-2 text-[11px]">
          {strength.checking ? (
            <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-muted-foreground">prüfe…</span></>
          ) : strength.ok ? (
            <><Check className="h-3 w-3 text-green-400" /><span className="text-green-400">Passwort OK</span></>
          ) : (
            <><AlertTriangle className="h-3 w-3 text-amber-400" /><span className="text-amber-400">{strength.reason || "zu schwach"}</span></>
          )}
        </div>
      )}
    </div>
  );
}
