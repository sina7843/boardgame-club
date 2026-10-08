// Catalog cover: one planet of each good and a development over the star chart.
import { GalaxyCard } from './renderer.tsx';
import { CARDS } from './rules.ts';

export default function RaceGalaxyCover({ title }: { title: string }) {
  const picks = ['n', 'r', 'g', 'a'].map((g) => CARDS.find((c) => c.type === 'world' && c.good === g && !c.start)!.id);
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="rg"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <div style={{ display: 'flex', gap: 6 }}>{picks.map((id, i) => <span key={id} style={{ transform: `translateY(${(i % 2) * 12}px)` }}><GalaxyCard id={id} good={i % 2 === 0} /></span>)}</div>
    </div>
  );
}
