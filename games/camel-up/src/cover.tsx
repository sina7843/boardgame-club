// Catalog cover: racing camel stacks before the pyramid on the painted desert.
import { CamelIcon } from './renderer.tsx';
import desert from './art/bd-desert.webp';
import pyramid from './art/pyramid.webp';

export default function CamelUpCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="cu"
      style={{ position: 'relative', display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: `radial-gradient(ellipse at 50% 60%, transparent, rgb(60 30 5 / 0.5)), url(${desert}) center / cover` }}>
      <img src={pyramid} alt="" draggable={false} style={{ position: 'absolute', insetBlockStart: '8%', inlineSize: '38%', opacity: 0.95, filter: 'drop-shadow(0 8px 10px rgb(30 12 0 / 0.6))' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 14, marginBlockStart: '30%' }}>
        <span style={{ display: 'grid' }}>{(['white', 'orange', 'blue'] as const).map((c) => <span key={c} style={{ marginBlockEnd: -22 }}><CamelIcon c={c} size={3.2} /></span>)}</span>
        <span style={{ display: 'grid' }}>{(['yellow', 'green'] as const).map((c) => <span key={c} style={{ marginBlockEnd: -22 }}><CamelIcon c={c} size={3.2} /></span>)}</span>
      </div>
    </div>
  );
}
