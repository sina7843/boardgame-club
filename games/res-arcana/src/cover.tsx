// Catalog cover: a row of essence gems above a place of power.
import { ArcCard, Gems } from './renderer.tsx';
import { CARDS } from './rules.ts';

export default function ResArcanaCover({ title }: { title: string }) {
  const tower = CARDS.find((c) => c.kind === 'place')!.id;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="ra"
      style={{ display: 'grid', placeItems: 'center', gap: 8, inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <span style={{ transform: 'scale(1.6)' }}><Gems pile={{ e: 1, l: 1, c: 1, d: 1, g: 1 }} /></span>
      <ArcCard id={tower} />
    </div>
  );
}
