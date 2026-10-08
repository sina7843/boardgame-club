// Catalog cover: a little row of town cards and a pair of dice.
import { TownCard } from './renderer.tsx';

export default function MachiKoroCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="mk"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'linear-gradient(180deg, #8fd0f2 0 50%, #7cc06a 50%)' }}>
      <div style={{ display: 'flex', gap: 6, transform: 'scale(1.3)' }}>{(['wheat', 'bakery', 'cafe', 'stadium'] as const).map((k, i) => <span key={k} style={{ transform: `rotate(${(i - 1.5) * 5}deg)` }}><TownCard k={k} /></span>)}</div>
    </div>
  );
}
