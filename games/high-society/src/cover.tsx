// Catalog cover: an art-deco salon — the palace card, a prestige card in its red frame, and a fan of banknotes.
import { Card } from './renderer.tsx';

export default function HighSocietyCover({ title }: { title: string }) {
  const note = (v: number, x: string, y: string, r: number) => (
    <span className="hs-note hs-note--md" data-v={v} style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg)` }}><b>{v.toLocaleString('fa-IR')}</b></span>
  );
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="hs"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 30%, #3a2a14, #0d0905)' }}>
      <span style={{ position: 'absolute', insetInlineStart: '22%', insetBlockStart: '14%', transform: 'rotate(-8deg) scale(0.9)' }}><Card c="prestige" /></span>
      <span style={{ position: 'absolute', insetInlineStart: '42%', insetBlockStart: '9%', transform: 'rotate(5deg)' }}><Card c="l10" /></span>
      {note(25, '68%', '58%', -14)}{note(12, '74%', '42%', 8)}{note(3, '10%', '64%', 12)}
    </div>
  );
}
