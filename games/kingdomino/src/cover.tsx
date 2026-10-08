// Catalog cover: a small painted kingdom around its castle with a couple of loose dominoes.
import { Domino, Square } from './renderer.tsx';
import type { Cell } from './rules.ts';

const MAP: (Cell | null)[][] = [
  [{ t: 'F', c: 0 }, { t: 'F', c: 1 }, { t: 'L', c: 0 }, { t: 'L', c: 1 }],
  [{ t: 'W', c: 1 }, { t: 'C', c: 0 }, { t: 'L', c: 0 }, { t: 'G', c: 2 }],
  [{ t: 'W', c: 0 }, { t: 'W', c: 0 }, { t: 'S', c: 1 }, { t: 'M', c: 3 }]
];

export default function KingdominoCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="kd"
      style={{ position: 'relative', display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #3a5a2e, #142010)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 2, transform: 'scale(1.5) rotate(-6deg)', direction: 'ltr' }}>
        {MAP.flat().map((c, i) => <Square key={i} cell={c} />)}
      </div>
      <span style={{ position: 'absolute', insetInlineStart: '8%', insetBlockStart: '12%', transform: 'rotate(14deg)' }}><Domino dom={46} /></span>
      <span style={{ position: 'absolute', insetInlineStart: '74%', insetBlockStart: '70%', transform: 'rotate(-12deg)' }}><Domino dom={40} /></span>
    </div>
  );
}
