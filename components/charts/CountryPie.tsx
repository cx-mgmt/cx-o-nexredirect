"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#22d3ee", "#34d399", "#a78bfa", "#fbbf24", "#f87171", "#60a5fa", "#f472b6", "#facc15"];

export function CountryPie({ data }: { data: { country: string; hits: number }[] }) {
  if (data.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">Noch keine Daten.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="hits" nameKey="country" outerRadius={100} label={({ country }) => country}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12, color: "#e5e7eb" }}
          itemStyle={{ color: "#e5e7eb" }}
          labelStyle={{ color: "#a1a1aa" }}
          formatter={(value: number, name: string) => [value.toLocaleString("de-DE"), name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#e5e7eb" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
