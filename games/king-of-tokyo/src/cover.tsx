// Catalog cover: a comic-ink dragon looming over dice, in front of the neon skyline.
import { DieFace } from './renderer.tsx';
import { Monster, Skyline } from './art.tsx';

export default function KingOfTokyoCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="kt"
      style={{ position: 'relative', display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', padding: 0, borderRadius: 0, background: 'radial-gradient(70% 90% at 50% 100%, #5a2b8f, transparent 70%), linear-gradient(180deg, #3a1f7a, #120c2a)' }}>
      <Skyline />
      <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 6, ['--h' as string]: 350 }}>
        <span style={{ inlineSize: '34%', minInlineSize: 64, aspectRatio: '1', filter: 'drop-shadow(0 4px 0 rgb(0 0 0 / 0.5))' }}><Monster k={0} /></span>
        <div style={{ display: 'flex', gap: 4, transform: 'scale(0.8)' }}>{(['claw', 'heart', 'bolt'] as const).map((f, i) => <span key={i} style={{ transform: `rotate(${(i - 1) * 10}deg)` }}><DieFace f={f} /></span>)}</div>
      </div>
    </div>
  );
}
