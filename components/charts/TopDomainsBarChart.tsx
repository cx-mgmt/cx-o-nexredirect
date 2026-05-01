"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function TopDomainsBarChart({ data }: { data: { domain: string; hits: number }[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Noch keine Hits.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(82,95,122,0.2)" />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
        <YAxis type="category" dataKey="domain" tick={{ fontSize: 10, fill: "#a1a1aa" }} width={120} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12, color: "#e5e7eb" }}
          itemStyle={{ color: "#e5e7eb" }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Bar dataKey="hits" fill="#34d399" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
