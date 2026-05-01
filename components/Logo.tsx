export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="nr-line" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <radialGradient id="nr-bg" cx="30%" cy="25%" r="85%">
          <stop offset="0%" stopColor="#1a1f2e" />
          <stop offset="100%" stopColor="#0a0c10" />
        </radialGradient>
        <linearGradient id="nr-r" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <filter id="nr-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="80" height="80" rx="20" fill="url(#nr-bg)" />
      <rect x="0.5" y="0.5" width="79" height="79" rx="19.5" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1" />
      <g filter="url(#nr-glow)">
        <text
          x="40"
          y="55"
          textAnchor="middle"
          textLength="48"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="Georgia,'Times New Roman',serif"
          fontSize="44"
          fontWeight="400"
          fill="#f3f4f6"
        >
          n<tspan fill="url(#nr-r)">r</tspan>
        </text>
      </g>
      <line x1="24" y1="63" x2="56" y2="63" stroke="url(#nr-line)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
