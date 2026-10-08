// Catalog cover: a fanned hand — gold, an action, a province — on royal velvet.
import { DomCard } from './renderer.tsx';

export default function DominionCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="dm"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 35%, #7a2a2a, #2a0808)' }}>
      <div style={{ display: 'flex' }}>
        {(['gold', 'village', 'smithy', 'province'] as const).map((c, i) => (
          <span key={c} style={{ marginInline: -10, transform: `rotate(${(i - 1.5) * 10}deg) translateY(${Math.abs(i - 1.5) * 8}px)` }}><DomCard c={c} /></span>
        ))}
      </div>
    </div>
  );
}
