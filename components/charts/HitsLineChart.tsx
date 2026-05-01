"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function HitsLineChart({ data }: { data: { day: string; hits: number }[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Noch keine Hits.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(82,95,122,0.2)" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
        <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12, color: "#e5e7eb" }}
          itemStyle={{ color: "#e5e7eb" }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Line type="monotone" dataKey="hits" stroke="#22d3ee" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
