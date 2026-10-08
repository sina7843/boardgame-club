// Catalog cover: a 3×3 patch of countryside — a walled city, a road and a monastery with followers on them.
import { TileArt, TileDefs } from './renderer.tsx';

const PATCH: [string, number, Record<string, number>][] = [
  ['M', 1, {}], ['F', 0, { c0: 0 }], ['N', 2, {}],
  ['V', 0, {}], ['C', 0, {}], ['K', 3, {}],
  ['U', 1, { r0: 1 }], ['A', 2, { m: 2 }], ['E', 2, {}]
];

export default function CarcassonneCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="cc"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #4d3520, #1c1208)' }}>
      <TileDefs />
      <div dir="ltr" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', inlineSize: '64%', aspectRatio: '1', transform: 'rotate(-8deg)', boxShadow: '0 10px 24px #000' }}>
        {PATCH.map(([t, r, m], i) => <TileArt key={i} t={t} rot={r} meeples={m} />)}
      </div>
    </div>
  );
}
