// Catalog cover: goods cards fanned on a market carpet with a camel at the side.
import { GoodCard } from './renderer.tsx';

export default function JaipurCover({ title }: { title: string }) {
  const at = (x: string, y: string, c: Parameters<typeof GoodCard>[0]['c'], r: number) => <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg)` }}><GoodCard c={c} /></span>;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="jp"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'repeating-linear-gradient(45deg, #7a1f1f 0 12px, #6a1919 12px 24px)', boxShadow: 'inset 0 0 0 6px #1f2f5a, inset 0 0 0 10px #e3b96a' }}>
      {at('16%', '22%', 'diamond', -12)}{at('32%', '16%', 'spice', -4)}{at('48%', '14%', 'cloth', 4)}{at('64%', '20%', 'gold', 12)}{at('78%', '42%', 'camel', 18)}
    </div>
  );
}
