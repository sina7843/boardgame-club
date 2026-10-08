// Catalog cover: monster dice tumbling in front of a neon skyline.
import { DieFace } from './renderer.tsx';

export default function KingOfTokyoCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="kt"
      style={{ position: 'relative', display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'linear-gradient(180deg, #3a1f7a, #120c2a)' }}>
      <span className="kt__skyline" aria-hidden="true" />
      <div style={{ position: 'relative', display: 'flex', gap: 8, transform: 'scale(1.4)' }}>{(['claw', 'heart', 'bolt', '3', 'claw'] as const).map((f, i) => <span key={i} style={{ transform: `rotate(${(i - 2) * 9}deg)` }}><DieFace f={f} /></span>)}</div>
    </div>
  );
}
