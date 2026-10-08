// Catalog cover: a painted dragon over dice, in front of the neon city.
import { DieFace } from './renderer.tsx';
import { Monster } from './art.tsx';
import city from './art/bd-city.webp';

export default function KingOfTokyoCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="kt"
      style={{ position: 'relative', display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', padding: 0, borderRadius: 0, background: `linear-gradient(rgb(18 12 42 / 0.45), rgb(18 12 42 / 0.65)), url(${city}) center / cover` }}>
      <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 6, ['--h' as string]: 350 }}>
        <span style={{ inlineSize: '34%', minInlineSize: 64, aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 0 0 3px #14102a, 0 4px 0 3px rgb(0 0 0 / 0.5)' }}><Monster k={0} /></span>
        <div style={{ display: 'flex', gap: 4, transform: 'scale(0.8)' }}>{(['claw', 'heart', 'bolt'] as const).map((f, i) => <span key={i} style={{ transform: `rotate(${(i - 1) * 10}deg)` }}><DieFace f={f} /></span>)}</div>
      </div>
    </div>
  );
}
