// Catan vector art: board defs (gradients, textures, shadows), terrain motifs, resource icons, robber and dice faces.
// Purely decorative: every part is aria-hidden or sits inside an element that already carries the accessible label.
import type { Res, Terrain } from './board.ts';

const STOPS: Record<Terrain, [string, string]> = {
  hills: ['#dd8656', '#a64d28'], forest: ['#438f51', '#245a30'], pasture: ['#b2da78', '#79ab4c'],
  fields: ['#f3d263', '#d3a62d'], mountains: ['#abb1bc', '#767c88'], desert: ['#efdcab', '#cfb67c']
};
export const TERRAINS = Object.keys(STOPS) as Terrain[];

/** All gradients, patterns, filters and reusable symbols for the board; render once inside the board <svg>. */
export function BoardDefs() {
  return (
    <defs>
      <radialGradient id="ctb-sea" cx="50%" cy="45%" r="75%"><stop offset="0" stopColor="#47a0c8" /><stop offset="0.6" stopColor="#2a6f97" /><stop offset="1" stopColor="#164e6c" /></radialGradient>
      <pattern id="ctb-waves" width="28" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 7 Q7 1 14 7 T28 7" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.2" />
        <path d="M-7 14 Q0 10 7 14 T21 14 T35 14" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1" />
      </pattern>
      <linearGradient id="ctb-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b98251" /><stop offset="0.5" stopColor="#7d5029" /><stop offset="1" stopColor="#5a3819" /></linearGradient>
      <pattern id="ctb-grain" width="64" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">
        <path d="M0 2 H64" stroke="#2c1706" strokeOpacity="0.28" strokeWidth="0.7" />
        <path d="M0 5 Q16 3.6 32 5 T64 5" fill="none" stroke="#e8c08c" strokeOpacity="0.2" strokeWidth="0.8" />
      </pattern>
      <radialGradient id="ctb-brass" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff2b8" /><stop offset="0.5" stopColor="#d1a23c" /><stop offset="1" stopColor="#7a5a14" /></radialGradient>
      {TERRAINS.map((t) => (
        <linearGradient key={t} id={`ctb-g-${t}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={STOPS[t][0]} /><stop offset="1" stopColor={STOPS[t][1]} /></linearGradient>
      ))}
      <pattern id="ctb-p-hills" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 0H16M0 4H16M4 0V4M12 4V8" fill="none" stroke="#4a1a08" strokeOpacity="0.3" strokeWidth="0.8" /></pattern>
      <pattern id="ctb-p-forest" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="#06280d" fillOpacity="0.3" /><circle cx="8" cy="8" r="0.9" fill="#d6f2c4" fillOpacity="0.2" /></pattern>
      <pattern id="ctb-p-pasture" width="12" height="10" patternUnits="userSpaceOnUse"><path d="M2 6 l-1.2 -3 M2 6 l1.2 -3 M8 10 l-1.2 -3 M8 10 l1.2 -3" stroke="#fff" strokeOpacity="0.38" strokeWidth="0.9" strokeLinecap="round" /></pattern>
      <pattern id="ctb-p-fields" width="8" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M0 0.5 H8" stroke="#7a5200" strokeOpacity="0.26" strokeWidth="1.2" /></pattern>
      <pattern id="ctb-p-mountains" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 V6" stroke="#1e2330" strokeOpacity="0.2" strokeWidth="1" /></pattern>
      <pattern id="ctb-p-desert" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" fill="#6e4f1c" fillOpacity="0.32" /><circle cx="6.5" cy="6" r="0.7" fill="#6e4f1c" fillOpacity="0.25" /></pattern>
      <linearGradient id="ctb-bevel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.65" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.5" /></linearGradient>
      <linearGradient id="ctb-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.38" /></linearGradient>
      <radialGradient id="ctb-token" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#fffbed" /><stop offset="0.6" stopColor="#efe3c3" /><stop offset="1" stopColor="#c9b583" /></radialGradient>
      <radialGradient id="ctb-robber" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#7b7266" /><stop offset="0.55" stopColor="#2f2a24" /><stop offset="1" stopColor="#12100d" /></radialGradient>
      <linearGradient id="ctb-pine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#55a561" /><stop offset="1" stopColor="#1b4b27" /></linearGradient>
      <linearGradient id="ctb-brick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dd6a40" /><stop offset="1" stopColor="#9b391d" /></linearGradient>
      <linearGradient id="ctb-dune" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbefc9" /><stop offset="1" stopColor="#d3b676" /></linearGradient>
      <filter id="ctb-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="1" dy="3" stdDeviation="2.4" floodColor="#001a2b" floodOpacity="0.45" /></filter>
      <filter id="ctb-soft" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0.8" dy="1.6" stdDeviation="1" floodColor="#000" floodOpacity="0.5" /></filter>

      <g id="ctb-tree">
        <ellipse cx="2" cy="1" rx="9" ry="2.6" fill="#000" opacity="0.25" />
        <rect x="-1.7" y="-5" width="3.4" height="6" fill="#6b4423" />
        <path d="M0 -25 L6.5 -14 H-6.5Z" fill="url(#ctb-pine)" stroke="#12331a" strokeWidth="0.6" strokeLinejoin="round" />
        <path d="M0 -20 L8.5 -8 H-8.5Z" fill="url(#ctb-pine)" stroke="#12331a" strokeWidth="0.6" strokeLinejoin="round" />
        <path d="M0 -14 L10.5 -3 H-10.5Z" fill="url(#ctb-pine)" stroke="#12331a" strokeWidth="0.6" strokeLinejoin="round" />
      </g>
      <g id="ctb-stalk">
        <path d="M0 0 Q-1 -10 0.5 -21" fill="none" stroke="#7a5a0e" strokeWidth="1.2" strokeLinecap="round" />
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <ellipse cx="-2.4" cy={-20 + k * 3.4} rx="1.5" ry="3" transform={`rotate(-28 -2.4 ${-20 + k * 3.4})`} fill="#b8860b" stroke="#6b4a06" strokeWidth="0.5" />
            <ellipse cx="2.4" cy={-18.5 + k * 3.4} rx="1.5" ry="3" transform={`rotate(28 2.4 ${-18.5 + k * 3.4})`} fill="#d3a017" stroke="#6b4a06" strokeWidth="0.5" />
          </g>
        ))}
        <ellipse cx="0.5" cy="-24" rx="1.4" ry="3" fill="#d3a017" stroke="#6b4a06" strokeWidth="0.5" />
      </g>
      <g id="ctb-wheat">
        <use href="#ctb-stalk" transform="rotate(-16)" /><use href="#ctb-stalk" transform="rotate(14) scale(0.95)" /><use href="#ctb-stalk" />
      </g>
      <g id="ctb-peak">
        <ellipse cx="4" cy="1" rx="22" ry="3" fill="#000" opacity="0.22" />
        <path d="M-18 0 L-2 -26 L16 0Z" fill="#9097a4" stroke="#3b414c" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M-2 -26 L16 0 L3 0 L-1 -9Z" fill="#555b68" />
        <path d="M-2 -26 L-8.5 -15.5 L-5 -17.5 L-2 -12.5 L1.5 -17.5 L4.5 -15.5Z" fill="#fff" stroke="#c9d3df" strokeWidth="0.5" strokeLinejoin="round" />
        <path d="M8 0 L18 -16 L28 0Z" fill="#7e8592" stroke="#3b414c" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M18 -16 L28 0 L19 0Z" fill="#4a505c" />
        <path d="M18 -16 L14.5 -10.5 L17 -11.5 L18.5 -9 L20.5 -11.5 L22 -10.5Z" fill="#fff" />
      </g>
      <g id="ctb-sheep">
        <ellipse cx="0" cy="1" rx="11" ry="2.6" fill="#000" opacity="0.22" />
        <rect x="-5" y="-4" width="1.8" height="5" rx="0.6" fill="#3a3430" /><rect x="3" y="-4" width="1.8" height="5" rx="0.6" fill="#3a3430" />
        <ellipse cx="-9" cy="-7" rx="3.2" ry="3.6" fill="#3a3430" /><circle cx="-10.4" cy="-8" r="0.7" fill="#fff" />
        {[[-5, -7], [0, -9.5], [5, -7.5], [-2, -4], [3.5, -4]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r="5" fill="#fbfbf3" stroke="#bfc3b0" strokeWidth="0.7" />)}
        <circle cx="-2" cy="-10.5" r="2.6" fill="#fff" opacity="0.8" />
      </g>
      <g id="ctb-tuft"><path d="M0 0 L-3 -6 M0 0 L0 -8 M0 0 L3 -6" fill="none" stroke="#3f7a22" strokeWidth="1.3" strokeLinecap="round" /></g>
      <g id="ctb-bricks">
        <ellipse cx="0" cy="1" rx="17" ry="2.6" fill="#000" opacity="0.22" />
        <rect x="-15" y="-5" width="14" height="5.4" rx="0.9" fill="url(#ctb-brick)" stroke="#5a1f0e" strokeWidth="0.7" />
        <rect x="1" y="-5" width="14" height="5.4" rx="0.9" fill="url(#ctb-brick)" stroke="#5a1f0e" strokeWidth="0.7" />
        <rect x="-7" y="-10.4" width="14" height="5.4" rx="0.9" fill="url(#ctb-brick)" stroke="#5a1f0e" strokeWidth="0.7" />
        <path d="M-14 -4 H-2 M2 -4 H14 M-6 -9.4 H6" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <g id="ctb-dune">
        <ellipse cx="2" cy="1" rx="22" ry="3" fill="#000" opacity="0.15" />
        <path d="M-22 0 Q-10 -15 4 -5 Q13 -11 24 0Z" fill="url(#ctb-dune)" stroke="#9c7f43" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M-14 -4 Q-9 -9 -4 -7" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <g id="ctb-cactus">
        <ellipse cx="1" cy="1" rx="8" ry="2.2" fill="#000" opacity="0.2" />
        <path d="M-2 0 V-17 Q-2 -20 0 -20 Q2 -20 2 -17 V0Z" fill="#4c9a4f" stroke="#1f5a27" strokeWidth="0.8" />
        <path d="M-2 -7 H-6 V-13 M2 -9 H6 V-15" fill="none" stroke="#1f5a27" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-2 -7 H-6 V-13 M2 -9 H6 V-15" fill="none" stroke="#4c9a4f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </defs>
  );
}

// [symbol id, x, y, scale (negative x-scale mirrors)] relative to the hex centre. Kept clear of the number token and name.
const SPOTS: Record<Terrain, [string, number, number, number][]> = {
  forest: [['tree', -38, 10, 1], ['tree', -27, 29, 0.9], ['tree', 38, 10, 1], ['tree', 27, 29, 0.9], ['tree', 0, 51, 0.65], ['tree', -39, -9, 0.7], ['tree', 39, -9, 0.7]],
  fields: [['wheat', -40, 22, 1], ['wheat', -28, 31, 0.9], ['wheat', 40, 22, 1], ['wheat', 28, 31, 0.9], ['wheat', 0, 52, 0.6]],
  mountains: [['peak', -33, 28, 0.8], ['peak', 33, 30, -0.7], ['peak', 0, 53, 0.45]],
  pasture: [['sheep', -33, 24, 1], ['sheep', 34, 28, -0.9], ['sheep', -14, 46, 0.55], ['tuft', 38, -4, 1], ['tuft', -40, -6, 1], ['tuft', 17, 46, 1]],
  hills: [['bricks', -33, 24, 0.9], ['bricks', 34, 30, 0.8], ['bricks', 0, 53, 0.5], ['bricks', -37, -4, 0.45]],
  desert: [['dune', -24, 30, 0.9], ['dune', 22, 38, -0.7], ['cactus', 34, 8, 1], ['cactus', -36, 8, 0.7]]
};

export function TerrainArt({ terrain }: { terrain: Terrain }) {
  return (
    <g className="ct-motif" aria-hidden="true" pointerEvents="none">
      {SPOTS[terrain].map(([id, x, y, s], k) => <use key={k} href={`#ctb-${id}`} transform={`translate(${x} ${y}) scale(${s} ${Math.abs(s)})`} />)}
    </g>
  );
}

/** Wooden pawn; drawn at the origin, ~30 units tall. */
export function RobberPawn() {
  return (
    <g className="ct-robber__body">
      <ellipse cx="1.5" cy="10.5" rx="11" ry="3.6" fill="#000" opacity="0.35" />
      <ellipse cx="0" cy="9" rx="9.5" ry="3.6" fill="url(#ctb-robber)" stroke="#f6efdc" strokeWidth="1.2" />
      <path d="M-8 9 Q-6.5 -1 -3.4 -5 H3.4 Q6.5 -1 8 9Z" fill="url(#ctb-robber)" stroke="#f6efdc" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="0" cy="-10" r="6" fill="url(#ctb-robber)" stroke="#f6efdc" strokeWidth="1.2" />
      <ellipse cx="-2.2" cy="-12.2" rx="2" ry="1.3" fill="#fff" opacity="0.55" />
      <path d="M-4 5 Q-5 1 -3 -2" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

const ICON_STROKE = '#2a2520';
/** Illustrated resource icon, 24x24, no gradients (so it can be repeated freely). */
export function ResIcon({ r }: { r: Res }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false as const, className: 'ct-ico' };
  switch (r) {
    case 'brick': return (
      <svg {...common}>
        <g fill="#c8512b" stroke={ICON_STROKE} strokeWidth="1" strokeLinejoin="round">
          <rect x="2" y="13.5" width="9.5" height="6" rx="1" /><rect x="12.5" y="13.5" width="9.5" height="6" rx="1" /><rect x="7.2" y="6.5" width="9.6" height="6" rx="1" />
        </g>
        <path d="M3.2 15 H10 M13.7 15 H20.8 M8.4 8 H15.6" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
    case 'lumber': return (
      <svg {...common}>
        <rect x="5" y="4.5" width="16" height="7" rx="1.5" fill="#9a6a38" stroke={ICON_STROKE} strokeWidth="1" />
        <rect x="3" y="12.5" width="18" height="7.5" rx="1.5" fill="#8a5a2b" stroke={ICON_STROKE} strokeWidth="1" />
        <ellipse cx="5" cy="8" rx="2.4" ry="3.5" fill="#e3b678" stroke={ICON_STROKE} strokeWidth="1" /><ellipse cx="5" cy="8" rx="0.9" ry="1.6" fill="none" stroke="#8a5a2b" strokeWidth="0.8" />
        <ellipse cx="3.5" cy="16.2" rx="2.4" ry="3.6" fill="#e3b678" stroke={ICON_STROKE} strokeWidth="1" /><ellipse cx="3.5" cy="16.2" rx="0.9" ry="1.6" fill="none" stroke="#8a5a2b" strokeWidth="0.8" />
      </svg>
    );
    case 'wool': return (
      <svg {...common}>
        <g fill="#fbfbf3" stroke={ICON_STROKE} strokeWidth="1">
          <rect x="7" y="16" width="2" height="5" fill="#3a3430" /><rect x="14" y="16" width="2" height="5" fill="#3a3430" />
          <circle cx="8" cy="11" r="4.2" /><circle cx="13" cy="9" r="4.6" /><circle cx="17" cy="12.5" r="4" /><circle cx="12" cy="14" r="4.2" />
        </g>
        <ellipse cx="3.6" cy="12" rx="2.6" ry="3" fill="#3a3430" stroke={ICON_STROKE} strokeWidth="0.8" />
      </svg>
    );
    case 'grain': return (
      <svg {...common}>
        <path d="M12 22 Q11 14 12.5 5" fill="none" stroke="#7a5a0e" strokeWidth="1.4" strokeLinecap="round" />
        <g fill="#e2b020" stroke={ICON_STROKE} strokeWidth="0.9">
          {[0, 1, 2, 3].map((k) => <ellipse key={`l${k}`} cx="9.2" cy={8 + k * 3.4} rx="1.9" ry="3.2" transform={`rotate(-30 9.2 ${8 + k * 3.4})`} />)}
          {[0, 1, 2, 3].map((k) => <ellipse key={`r${k}`} cx="15.4" cy={6.5 + k * 3.4} rx="1.9" ry="3.2" transform={`rotate(30 15.4 ${6.5 + k * 3.4})`} />)}
          <ellipse cx="12.6" cy="3.6" rx="1.8" ry="3" />
        </g>
      </svg>
    );
    case 'ore': return (
      <svg {...common}>
        <path d="M3 17 L7 7 L13 4 L20 9 L21 17 L12 21Z" fill="#8f98a8" stroke={ICON_STROKE} strokeWidth="1" strokeLinejoin="round" />
        <path d="M7 7 L13 4 L12 12Z" fill="#c9d1de" /><path d="M13 4 L20 9 L12 12Z" fill="#a9b2c2" /><path d="M12 12 L21 17 L12 21Z" fill="#5f6878" /><path d="M3 17 L7 7 L12 12 L12 21Z" fill="#79828f" />
        <path d="M7 7 L13 4 L20 9 L21 17 L12 21 L3 17Z M12 12 L7 7 M12 12 L13 4 M12 12 L20 9 M12 12 L21 17 M12 12 L12 21 M12 12 L3 17" fill="none" stroke={ICON_STROKE} strokeWidth="0.7" strokeLinejoin="round" />
      </svg>
    );
  }
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** CSS-drawn die face (3x3 pip grid). Decorative: the parent carries the label. */
export function DieFace({ value, red }: { value: number; red?: boolean }) {
  return (
    <span aria-hidden="true" className={red ? 'ct-die ct-die--red' : 'ct-die'}>
      {Array.from({ length: 9 }, (_, k) => <i key={k} className={PIPS[value]?.includes(k) ? 'ct-die__pip' : ''} />)}
    </span>
  );
}
