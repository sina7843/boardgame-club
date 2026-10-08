// Catalog cover: a fan of glazed, motif-inlaid tiles on a lapis wall.
import { Tile } from './renderer.tsx';
import { wallColor } from './rules.ts';

export default function AzulCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="az"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, auto)', gap: 4, transform: 'rotate(-8deg) scale(1.1)', filter: 'drop-shadow(0 6px 6px rgb(0 0 0 / 0.5))' }}>
        {Array.from({ length: 21 }, (_, i) => <Tile key={i} c={wallColor(Math.floor(i / 7) % 5, i % 5)} ghost={i % 4 === 3} />)}
      </div>
    </div>
  );
}
