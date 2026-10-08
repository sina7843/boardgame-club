// Catalog cover: a corner of the nautical chart with a battleship, one hit and two splashes.
import bdOcean from './art/bd-ocean.webp';
import { Hull, Shot } from './renderer.tsx';

export default function BattleshipCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="bs"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(120% 120% at 30% 25%, #1d5d82, #0d3550)' }}>
      <svg viewBox="0 0 60 40" style={{ inlineSize: '86%' }} aria-hidden>
        <image href={bdOcean} width="60" height="40" preserveAspectRatio="xMidYMid slice" />
        {Array.from({ length: 5 }, (_, i) => <path key={`v${i}`} d={`M${(i + 1) * 10} 0 V40`} className="bs-grid" />)}
        {Array.from({ length: 3 }, (_, i) => <path key={`h${i}`} d={`M0 ${(i + 1) * 10} H60`} className="bs-grid" />)}
        <Hull s={{ ship: 1, x: 1, y: 1, dir: 'h' }} />
        <Hull s={{ ship: 4, x: 3, y: 3, dir: 'h' }} />
        <Shot x={25} y={15} hit />
        <Shot x={55} y={5} hit={false} />
        <Shot x={5} y={35} hit={false} />
      </svg>
    </div>
  );
}
