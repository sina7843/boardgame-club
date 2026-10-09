// Catalog cover: each hero portrait with its die tumbling over the arena floor.
import { DieFace, PORTRAIT } from './renderer.tsx';
import { HEROES } from './rules.ts';

export default function DiceThroneCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="dt"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {HEROES.map((h, i) => (
          <span key={h.key} className={`dt-h--${h.key}`} style={{ display: 'grid', gap: 4, justifyItems: 'center', transform: `rotate(${(i - 1.5) * 14}deg) translateY(${(i % 2) * 10}px)` }}>
            <img className="dt-portrait dt-portrait--lg" src={PORTRAIT[h.key]} alt="" />
            <DieFace hero={h} n={[1, 6, 6, 6][i]!} />
          </span>
        ))}
      </div>
    </div>
  );
}
