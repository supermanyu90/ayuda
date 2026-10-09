// A strip of grass that grows when you're ready to go. More grass for a better
// "world time vs screen time" ratio: the reward is literally touching grass.

export function GrassField({ ratio }: { ratio: number | null }) {
  const blades = Math.round(Math.min(Math.max((ratio ?? 20) / 2, 14), 44));
  const width = 600;
  return (
    <svg viewBox={`0 0 ${width} 90`} preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
      {Array.from({ length: blades }, (_, i) => {
        // Deterministic pseudo-random shape per blade.
        const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        const x = (i + 0.5) * (width / blades) + (r(1) - 0.5) * 8;
        const h = 40 + r(2) * 48;
        const lean = (r(3) - 0.5) * 22;
        const shade = ['#2f6b4f', '#3f8a5f', '#245a40', '#4e9b6a'][i % 4];
        return (
          <g key={i} className="grass-sway" style={{ animationDelay: `${r(4) * -4}s` }}>
            <path
              className="grass-blade"
              style={{ animationDelay: `${i * 22}ms` }}
              d={`M${x - 5} 90 Q${x + lean * 0.4} ${90 - h * 0.6} ${x + lean} ${90 - h} Q${x + lean * 0.3} ${90 - h * 0.5} ${x + 5} 90 Z`}
              fill={shade}
            />
          </g>
        );
      })}
    </svg>
  );
}
