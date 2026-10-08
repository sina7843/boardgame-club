// Catalog cover: three glowing numbers rising on an indigo night table.
import { Num } from './renderer.tsx';

export default function TheMindCover({ title }: { title: string }) {
  const at = (n: number, x: string, y: string, r: number) => <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg)` }}><Num n={n} size="md" /></span>;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="tm"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0, background: 'radial-gradient(circle at 50% 40%, #3a3480, #0f0d26)' }}>
      {at(12, '18%', '42%', -8)}{at(57, '42%', '26%', 2)}{at(93, '66%', '12%', 9)}
    </div>
  );
}
