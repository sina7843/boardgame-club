// Catalog cover: a small cluster of illustrated terrain hexes with a number token, a settlement, a city and roads
// on a wavy sea (vector only; shares the board's defs and motifs from art.tsx).
import { BoardDefs, TerrainArt } from './art.tsx';
import type { Terrain } from './board.ts';

const SQ3 = Math.sqrt(3);
const TILES: { q: number; r: number; terrain: Terrain }[] = [
  { q: 0, r: -1, terrain: 'forest' }, { q: 1, r: -1, terrain: 'fields' },
  { q: -1, r: 0, terrain: 'pasture' }, { q: 0, r: 0, terrain: 'hills' }, { q: 1, r: 0, terrain: 'mountains' },
  { q: -1, r: 1, terrain: 'desert' }, { q: 0, r: 1, terrain: 'forest' }
];
const HOUSE = ['M-8 8 V-1 H8 V8Z', 'M-10.5 -1 L0 -11 L10.5 -1Z'];
const CITY = ['M-13.5 8 V-1 H-4 V8Z', 'M-15 -1 L-8.7 -7 L-2.5 -1Z', 'M-4 8 V-8 H13 V8Z', 'M-5.6 -8 L4.5 -17 L14.6 -8Z'];

export default function CatanCover({ title }: { title: string }) {
  const s = 30;
  const corners = (cx: number, cy: number, k = 1) => Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return `${(cx + s * k * Math.cos(a)).toFixed(1)},${(cy + s * k * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const at = (q: number, r: number) => ({ x: 160 + SQ3 * s * (q + r / 2), y: 90 + 1.5 * s * r });
  const c = at(0, 0);
  const road = (x1: number, y1: number, x2: number, y2: number, fill: string) => (
    <g strokeLinecap="round">
      <line x1={x1 + 1} y1={y1 + 2} x2={x2 + 1} y2={y2 + 2} stroke="#000" strokeOpacity="0.3" strokeWidth="9" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1b1611" strokeWidth="9" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={fill} strokeWidth="6" />
      <line x1={x1 - 1} y1={y1 - 1.4} x2={x2 - 1} y2={y2 - 1.4} stroke="#fff" strokeOpacity="0.4" strokeWidth="1.5" />
    </g>
  );
  const piece = (shape: string[], fill: string, x: number, y: number) => (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="1" cy="8.8" rx="13" ry="3" fill="#000" opacity="0.32" />
      {shape.map((d) => <path key={d} d={d} fill={fill} stroke="#1b1611" strokeWidth="1.5" strokeLinejoin="round" />)}
      {shape.map((d) => <path key={`s${d}`} d={d} fill="url(#ctb-shine)" />)}
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <BoardDefs />
      <rect width="320" height="180" fill="url(#ctb-sea)" />
      <rect width="320" height="180" fill="url(#ctb-waves)" />
      {TILES.map((t) => {
        const p = at(t.q, t.r);
        return (
          <g key={`${t.q}${t.r}`}>
            <polygon points={corners(p.x, p.y)} fill={`url(#ctb-g-${t.terrain})`} stroke="#f2e6c8" strokeWidth="2" strokeLinejoin="round" filter="url(#ctb-shadow)" />
            <polygon points={corners(p.x, p.y)} fill={`url(#ctb-p-${t.terrain})`} />
            <polygon points={corners(p.x, p.y, 0.94)} fill="none" stroke="url(#ctb-bevel)" strokeWidth="1.4" strokeLinejoin="round" />
            <g transform={`translate(${p.x} ${p.y}) scale(0.5)`}><TerrainArt terrain={t.terrain} /></g>
          </g>
        );
      })}
      <circle cx={c.x} cy={c.y + 2} r="12" fill="url(#ctb-token)" stroke="#a8946a" strokeWidth="1" filter="url(#ctb-soft)" />
      <text x={c.x} y={c.y + 8} textAnchor="middle" fontSize="15" fontWeight="900" fill="#b3261e" fontFamily="Estedad Variable, Vazirmatn, Tahoma, sans-serif">۸</text>
      {road(c.x - SQ3 * s / 2, c.y - s / 2, c.x, c.y - s, '#c8323c')}
      {piece(HOUSE, '#c8323c', c.x, c.y - s)}
      {road(c.x + SQ3 * s / 2, c.y + s / 2, c.x, c.y + s, '#2f62c9')}
      {piece(CITY, '#2f62c9', c.x + SQ3 * s / 2, c.y + s / 2)}
      <rect x="1.5" y="1.5" width="317" height="177" fill="none" stroke="url(#ctb-wood)" strokeWidth="3" />
    </svg>
  );
}
