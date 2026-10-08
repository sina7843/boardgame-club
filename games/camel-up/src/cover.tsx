// Catalog cover: a stack of racing camels on desert dunes.
import { CamelIcon } from './renderer.tsx';

export default function CamelUpCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="cu"
      style={{ position: 'relative', display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'linear-gradient(180deg, #f7c46a 0 55%, #d99a48 55%)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
        <span style={{ display: 'grid' }}>{(['white', 'orange', 'blue'] as const).map((c) => <span key={c} style={{ marginBlockEnd: -10 }}><CamelIcon c={c} size={3.4} /></span>)}</span>
        <span style={{ display: 'grid' }}>{(['yellow', 'green'] as const).map((c) => <span key={c} style={{ marginBlockEnd: -10 }}><CamelIcon c={c} size={3.4} /></span>)}</span>
      </div>
    </div>
  );
}
