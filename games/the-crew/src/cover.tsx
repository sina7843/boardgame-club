// Catalog cover: a trick of four colours under rocket 4, on a violet nebula.
import { CrewCard } from './renderer.tsx';

export default function TheCrewCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="cw"
      style={{ display: 'grid', placeItems: 'center', gap: 8, inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <CrewCard c="r4" />
      <div style={{ display: 'flex', gap: 6 }}>{['p9', 'b7', 'g3', 'y5'].map((c, i) => <span key={c} style={{ transform: `rotate(${(i - 1.5) * 8}deg)` }}><CrewCard c={c} /></span>)}</div>
    </div>
  );
}
