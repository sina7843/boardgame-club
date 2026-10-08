// Catalog cover: five firework cards bursting over a night sky.
import { Firework } from './renderer.tsx';

export default function HanabiCover({ title }: { title: string }) {
  const cards = [['r', 5], ['y', 3], ['g', 4], ['b', 1], ['w', 2]] as const;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="hb"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 20%, #3a3a8a, #0c1530 70%)' }}>
      <div style={{ display: 'flex', gap: 8, transform: 'scale(1.5)' }}>{cards.map(([c, n], i) => <span key={c} style={{ transform: `translateY(${(i % 2) * 8}px) rotate(${(i - 2) * 6}deg)` }}><Firework c={c} n={n} /></span>)}</div>
    </div>
  );
}
