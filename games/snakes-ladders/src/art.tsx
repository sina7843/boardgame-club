// Snakes and Ladders vector art: board defs (wood, paper, sheen, shadows), tapered scaled snakes, wooden ladders and
// glossy pawns. Decorative only; the board <svg> carries the accessible description.

/** Head / body / dark shades per snake. */
export const SNAKE_HUES: [string, string, string][] = [
  ['#6fcf85', '#2f8f4e', '#1a5430'], ['#bf8fe0', '#7a3fa0', '#46205f'], ['#f0766a', '#c0392b', '#771d13'],
  ['#6aa6f0', '#1c63c9', '#0e3877'], ['#efc25a', '#b7791f', '#6a4208']
];

export function BoardDefs() {
  return (
    <defs>
      <linearGradient id="sl-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b98251" /><stop offset="0.5" stopColor="#7d5029" /><stop offset="1" stopColor="#573616" /></linearGradient>
      <pattern id="sl-grain" width="70" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
        <path d="M0 2 H70" stroke="#2c1706" strokeOpacity="0.26" strokeWidth="0.8" />
        <path d="M0 6 Q17 4.6 35 6 T70 6" fill="none" stroke="#e8c08c" strokeOpacity="0.2" strokeWidth="0.9" />
      </pattern>
      <pattern id="sl-paper" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.55" fill="#5a4021" fillOpacity="0.16" /><circle cx="5" cy="5" r="0.45" fill="#fff" fillOpacity="0.3" /></pattern>
      <linearGradient id="sl-bevel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.75" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#3a2a1a" stopOpacity="0" /><stop offset="1" stopColor="#3a2a1a" stopOpacity="0.35" /></linearGradient>
      <radialGradient id="sl-vignette" cx="50%" cy="50%" r="72%"><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#3a2a1a" stopOpacity="0.28" /></radialGradient>
      <radialGradient id="sl-brass" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff2b8" /><stop offset="0.5" stopColor="#d1a23c" /><stop offset="1" stopColor="#7a5a14" /></radialGradient>
      <radialGradient id="sl-sheen" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity="0.6" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="0.75" stopColor="#000" stopOpacity="0.1" /><stop offset="1" stopColor="#000" stopOpacity="0.45" /></radialGradient>
      <radialGradient id="sl-die-face" cx="32%" cy="28%" r="85%"><stop offset="0" stopColor="#fff" /><stop offset="0.55" stopColor="#fbf5e4" /><stop offset="1" stopColor="#d9ccaa" /></radialGradient>
      <radialGradient id="sl-pip" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#6a5f55" /><stop offset="0.6" stopColor="#1b130b" /><stop offset="1" stopColor="#000" /></radialGradient>
      {SNAKE_HUES.map(([l, m, d], i) => (
        <g key={i}>
          <linearGradient id={`sl-sn-${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={l} /><stop offset="0.55" stopColor={m} /><stop offset="1" stopColor={d} /></linearGradient>
          <radialGradient id={`sl-sh-${i}`} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor={l} /><stop offset="0.6" stopColor={m} /><stop offset="1" stopColor={d} /></radialGradient>
        </g>
      ))}
      <filter id="sl-drop" filterUnits="userSpaceOnUse" x="-20" y="-20" width="660" height="660"><feDropShadow dx="1.5" dy="3" stdDeviation="2.2" floodColor="#2a1b0a" floodOpacity="0.45" /></filter>
      <filter id="sl-soft" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0.8" dy="1.8" stdDeviation="1.2" floodColor="#000" floodOpacity="0.5" /></filter>
    </defs>
  );
}

type Pt = { x: number; y: number; nx: number; ny: number; w: number };

/** Tapered, scaled snake from head (x1,y1) to tail (x2,y2) along a lazy S-curve. */
export function SnakeArt({ x1, y1, x2, y2, hue }: { x1: number; y1: number; x2: number; y2: number; hue: number }) {
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [ox, oy] = [(-(y2 - y1) / len) * 34, ((x2 - x1) / len) * 34];
  const c1 = [(x1 + mx) / 2 + ox, (y1 + my) / 2 + oy], c2 = [(mx + x2) / 2 - ox, (my + y2) / 2 - oy];
  const at = (t: number) => {
    const u = 1 - t;
    return [u ** 3 * x1 + 3 * u * u * t * c1[0]! + 3 * u * t * t * c2[0]! + t ** 3 * x2, u ** 3 * y1 + 3 * u * u * t * c1[1]! + 3 * u * t * t * c2[1]! + t ** 3 * y2] as const;
  };
  const N = 44;
  const raw = Array.from({ length: N + 1 }, (_, k) => at(k / N));
  const pts: Pt[] = raw.map(([x, y], k) => {
    const [ax, ay] = raw[Math.max(0, k - 1)]!, [bx, by] = raw[Math.min(N, k + 1)]!;
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const t = k / N;
    return { x, y, nx: -(by - ay) / l, ny: (bx - ax) / l, w: 1.4 + 4.9 * (1 - t) + 1.3 * Math.sin(Math.PI * t) };
  });
  const side = (s: number, f = 1) => pts.map((p) => [p.x + p.nx * p.w * s * f, p.y + p.ny * p.w * s * f] as const);
  const poly = [...side(1), ...side(-1).reverse()].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
  const hi = side(1, 0.45).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
  const [h0, h1] = [pts[0]!, pts[3]!];
  const ang = (Math.atan2(h0.y - h1.y, h0.x - h1.x) * 180) / Math.PI;
  const [, mid, dark] = SNAKE_HUES[hue % SNAKE_HUES.length]!;
  return (
    <g className="sl-snake" aria-hidden="true" filter="url(#sl-soft)">
      <path d={`M${poly}Z`} fill={`url(#sl-sn-${hue})`} stroke={dark} strokeWidth="1.4" strokeLinejoin="round" />
      {pts.filter((_, k) => k >= 5 && k < N - 2 && k % 3 === 0).map((p, k) => (
        <ellipse key={k} cx={p.x} cy={p.y} rx={p.w * 0.42} ry={p.w * 0.8} fill={dark} fillOpacity={k % 2 ? 0.32 : 0.5} transform={`rotate(${(Math.atan2(p.nx, -p.ny) * 180) / Math.PI} ${p.x} ${p.y})`} />
      ))}
      <path d={`M${hi}`} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
      <g transform={`translate(${h0.x} ${h0.y}) rotate(${ang})`}>
        <path d="M12 0 H19 M19 0 L22.5 -2.4 M19 0 L22.5 2.4" fill="none" stroke="#d61f2c" strokeWidth="1.1" strokeLinecap="round" />
        <ellipse cx="3" rx="11.5" ry="8.4" fill={`url(#sl-sh-${hue})`} stroke={dark} strokeWidth="1.3" />
        <ellipse cx="0.5" cy="-3.2" rx="6" ry="2.2" fill="#fff" fillOpacity="0.28" />
        <circle cx="10" cy="-2" r="0.7" fill={dark} /><circle cx="10" cy="2" r="0.7" fill={dark} />
        {[-4.6, 4.6].map((y) => (
          <g key={y}>
            <circle cx="5" cy={y} r="3" fill="#fffbe6" stroke={dark} strokeWidth="0.7" />
            <ellipse cx="5.6" cy={y} rx="0.8" ry="2.1" fill="#111" />
          </g>
        ))}
      </g>
      <circle cx={pts[N]!.x} cy={pts[N]!.y} r="1.6" fill={mid} />
    </g>
  );
}

/** Wooden ladder between two points: shaded rails, dowel rungs with nails. */
export function LadderArt({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [nx, ny] = [(-(y2 - y1) / len) * 10, ((x2 - x1) / len) * 10];
  const rungs = Math.max(2, Math.floor(len / 22));
  const ts = Array.from({ length: rungs }, (_, i) => (i + 0.5) / rungs);
  const rail = (s: number) => {
    const [a, b, c, d] = [x1 + nx * s, y1 + ny * s, x2 + nx * s, y2 + ny * s];
    return (
      <g>
        <line x1={a} y1={b} x2={c} y2={d} stroke="#4a2c10" strokeWidth="7.4" strokeLinecap="round" />
        <line x1={a} y1={b} x2={c} y2={d} stroke="#a06c36" strokeWidth="5.2" strokeLinecap="round" />
        <line x1={a - 1} y1={b - 1} x2={c - 1} y2={d - 1} stroke="#e0b070" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    );
  };
  return (
    <g className="sl-ladder" aria-hidden="true" filter="url(#sl-drop)">
      {ts.map((t, i) => {
        const [x, y] = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
        return (
          <g key={i} className="sl-ladder__rung">
            <line x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} stroke="#4a2c10" strokeWidth="5.4" strokeLinecap="butt" />
            <line x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} stroke="#b9823f" strokeWidth="3.4" strokeLinecap="butt" />
            <line x1={x + nx - 0.6} y1={y + ny - 0.9} x2={x - nx - 0.6} y2={y - ny - 0.9} stroke="#f0cc90" strokeWidth="0.9" />
          </g>
        );
      })}
      {rail(1)}{rail(-1)}
      {ts.flatMap((t, i) => [1, -1].map((s) => (
        <circle key={`${i}${s}`} cx={x1 + (x2 - x1) * t + nx * s} cy={y1 + (y2 - y1) * t + ny * s} r="1.3" fill="#d9d2c0" stroke="#3a2610" strokeWidth="0.5" />
      )))}
    </g>
  );
}

/** Glossy stacked-disc pawn centred on the origin; the seat number is printed on top. */
export function PawnArt({ color, label, dark }: { color: string; label: string; dark?: boolean }) {
  return (
    <g className="sl-token__body" aria-hidden="true">
      <ellipse cx="1.5" cy="13" rx="13.5" ry="4.6" fill="#000" opacity="0.35" />
      <circle cy="3.5" r="13" fill={color} stroke="#fff" strokeWidth="2" />
      <circle cy="3.5" r="13" fill="#000" opacity="0.38" />
      <circle r="13" fill={color} stroke="#fff" strokeWidth="2.4" />
      <circle r="13" fill="url(#sl-sheen)" />
      <circle r="8.6" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.9" />
      <ellipse cx="-4.5" cy="-6.5" rx="5" ry="2.8" fill="#fff" opacity="0.5" transform="rotate(-30 -4.5 -6.5)" />
      <text y="5" className={dark ? 'sl-token__n sl-token__n--dark' : 'sl-token__n'}>{label}</text>
    </g>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]]
};
export const pipsOf = (v: number | null) => (v ? PIPS[v]! : []);
