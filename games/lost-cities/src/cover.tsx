// Catalog cover: five expedition columns on a parchment map, each with a short ascending run.
import { Card } from './renderer.tsx';

export default function LostCitiesCover({ title }: { title: string }) {
  const runs = [['y0', 'y4', 'y7'], ['b3', 'b6'], ['w0', 'w0', 'w5'], ['g2', 'g8', 'g10'], ['r9']];
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="lc"
      style={{ display: 'flex', gap: '6%', justifyContent: 'center', alignItems: 'flex-start', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', paddingBlockStart: '8%',
        background: 'radial-gradient(ellipse at 50% 40%, #efe0bd, #b89a62)' }}>
      {runs.map((r, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {r.map((id, k) => <span key={k} style={{ marginBlockStart: k ? '-1.2rem' : 0 }}><Card id={id} /></span>)}
        </div>
      ))}
    </div>
  );
}
