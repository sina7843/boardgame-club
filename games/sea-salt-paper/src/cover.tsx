// Catalog cover: folded paper creatures floating on a watercolour sea.
import { PaperCard } from './renderer.tsx';

export default function SeaSaltPaperCover({ title }: { title: string }) {
  const at = (x: string, y: string, id: number, r: number) => <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg) scale(1.3)` }}><PaperCard id={id} /></span>;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="sp2"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'repeating-linear-gradient(170deg, #2f6f93 0 14px, #2b678a 14px 28px)' }}>
      {at('12%', '22%', 0, -10)}{at('36%', '14%', 54, 4)}{at('60%', '24%', 34, 12)}{at('80%', '30%', 9, -6)}
    </div>
  );
}
