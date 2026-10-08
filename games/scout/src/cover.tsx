// Catalog cover: a run of circus cards fanned in a striped ring.
import { Act } from './renderer.tsx';
import { CARDS } from './rules.ts';

const id = (a: number, b: number) => CARDS.findIndex(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b));

export default function ScoutCover({ title }: { title: string }) {
  const cards = [[5, 2], [6, 9], [7, 1], [8, 3]] as const;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="sc"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'repeating-conic-gradient(from 0deg at 50% 120%, #c0392b 0 8deg, #f4ead6 8deg 16deg)' }}>
      <div style={{ display: 'flex', gap: 6, transform: 'scale(1.5)', direction: 'ltr' }}>
        {cards.map(([up, other], i) => <span key={i} style={{ transform: `rotate(${(i - 1.5) * 8}deg)` }}><Act c={{ id: id(up, other), up }} /></span>)}
      </div>
    </div>
  );
}
