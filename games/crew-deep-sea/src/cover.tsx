// Catalog cover: the crew's cards sinking through teal depths.
import type { CSSProperties } from 'react';
import bd from './art/bd-deep.webp'; // cut from a generated sheet (see DECISIONS.md)
import { CrewCard } from '@bg/game-the-crew/renderer';

export default function DeepSeaCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="cw cw--sea"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0, '--cw-bd': `url(${bd})` } as CSSProperties}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        {['b9', 'g1', 'r3', 'y6', 'p2'].map((c, i) => <span key={c} style={{ transform: `translateY(${(i % 2) * 14}px) rotate(${(i - 2) * 7}deg)` }}><CrewCard c={c} /></span>)}
      </div>
    </div>
  );
}
