// Catalog cover: two dice over a row of ships of rising level.
import { Die, ShipCard } from './renderer.tsx';
import { SHIPS } from './rules.ts';

export default function SpaceBaseCover({ title }: { title: string }) {
  const picks = [1, 2, 3].map((l) => SHIPS.find((x) => x.level === l && x.sector === 7)!.id);
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="sb"
      style={{ display: 'grid', placeItems: 'center', gap: 8, inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <span style={{ display: 'flex', gap: 6 }}><Die n={3} /><Die n={4} /></span>
      <div style={{ display: 'flex', gap: 6 }}>{picks.map((id) => <ShipCard key={id} id={id} />)}</div>
    </div>
  );
}
