// Catalog cover: a fan of glazed star tiles on a lapis wall pattern.
import { Tile } from './renderer.tsx';
import { wallColor } from './rules.ts';

export default function AzulCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="az"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #2a4d7a, #0e1d33)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, auto)', gap: 4, transform: 'rotate(-8deg)' }}>
        {Array.from({ length: 21 }, (_, i) => <Tile key={i} c={wallColor(Math.floor(i / 7) % 5, i % 5)} ghost={i % 4 === 3} />)}
      </div>
    </div>
  );
}
