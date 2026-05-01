export function Logo({ size = 32 }: { size?: number }) {
  const fontSize = Math.round(size * 0.46);
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-cyan-300/20 bg-zinc-900 shadow-[0_4px_12px_rgba(34,211,238,0.2)]"
      style={{ width: size, height: size, fontFamily: "Georgia,'Times New Roman',serif" }}
    >
      <span style={{ fontSize, fontWeight: 400, letterSpacing: "-1px", lineHeight: 1 }}>
        <span style={{ color: "#f3f4f6" }}>c</span>
        <span style={{ background: "linear-gradient(135deg,#22d3ee,#34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>x</span>
      </span>
    </div>
  );
}
