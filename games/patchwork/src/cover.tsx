// Catalog cover: a corner of a patchwork quilt in many fabrics with a couple of wooden buttons.
import { Shape } from './renderer.tsx';

export default function PatchworkCover({ title }: { title: string }) {
  const at = (x: string, y: string, id: number, rot: number, r: number) => <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg)` }}><Shape id={id} rot={rot} cell={1.6} /></span>;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="pw"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'repeating-linear-gradient(90deg, #efe5d2 0 6px, #e6dac2 6px 12px)' }}>
      {at('6%', '10%', 10, 0, -6)}{at('34%', '6%', 16, 1, 4)}{at('62%', '18%', 23, 2, -3)}{at('20%', '52%', 3, 0, 8)}{at('70%', '58%', 11, 1, -10)}
    </div>
  );
}
