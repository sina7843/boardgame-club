// Catalog cover: one ship of each faction fanned over a starfield.
import { SrCard } from './renderer.tsx';

export default function StarRealmsCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="sr"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <div style={{ display: 'flex' }}>
        {['flagship', 'mothership', 'missile', 'dreadnaught'].map((k, i) => (
          <span key={k} style={{ marginInline: -8, transform: `rotate(${(i - 1.5) * 9}deg) translateY(${Math.abs(i - 1.5) * 7}px)` }}><SrCard k={k} /></span>
        ))}
      </div>
    </div>
  );
}
