// Catalog cover: the hex jungle with four expedition pawns at the start.
import { MapSvg } from './renderer.tsx';

export default function ElDoradoCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="ed"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0, padding: 4 }}>
      <div style={{ inlineSize: '58%' }}><MapSvg view={{ explorers: [0, 1, 2, 3].map((pos) => ({ pos, deck: 0, hand: 0, discard: 0, arrived: false })) }} /></div>
    </div>
  );
}
