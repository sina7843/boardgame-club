// Catalog cover: a corner of the nautical chart with a battleship, one hit and two splashes.
import { Hull } from './renderer.tsx';

export default function BattleshipCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="bs"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(120% 120% at 30% 25%, #1d5d82, #0d3550)' }}>
      <svg viewBox="0 0 60 40" style={{ inlineSize: '86%' }} aria-hidden>
        {Array.from({ length: 5 }, (_, i) => <path key={`v${i}`} d={`M${(i + 1) * 10} 0 V40`} className="bs-grid" />)}
        {Array.from({ length: 3 }, (_, i) => <path key={`h${i}`} d={`M0 ${(i + 1) * 10} H60`} className="bs-grid" />)}
        <Hull s={{ ship: 1, x: 1, y: 1, dir: 'h' }} />
        <Hull s={{ ship: 4, x: 3, y: 3, dir: 'h' }} />
        <g className="bs-hit" transform="translate(25 15)"><circle r="3.9" className="bs-hit__glow" /><path d="M0 -3.6 L1 -1 L3.4 -1.9 L1.8 0.3 L3.2 2.6 L0.6 1.6 L-0.4 3.8 L-1.2 1.4 L-3.6 2.4 L-2 0.2 L-3.4 -2 L-0.9 -1.2 Z" className="bs-hit__flame" /></g>
        <g className="bs-miss" transform="translate(55 5)"><circle r="2.6" className="bs-miss__ring" /><circle r="0.9" className="bs-miss__dot" /></g>
        <g className="bs-miss" transform="translate(5 35)"><circle r="2.6" className="bs-miss__ring" /><circle r="0.9" className="bs-miss__dot" /></g>
      </svg>
    </div>
  );
}
