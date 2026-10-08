// Catalog cover: a row of district cards under the King's seal.
import { CharToken, DistrictCard } from './renderer.tsx';

export default function CitadelsCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="ct2"
      style={{ display: 'grid', placeItems: 'center', gap: 6, inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 30%, #5a3d22, #1a0f06)' }}>
      <span style={{ inlineSize: '22%' }}><CharToken c={4} /></span>
      <div style={{ display: 'flex', gap: 6 }}>{[9, 21, 41, 52].map((id, i) => <span key={id} style={{ transform: `rotate(${(i - 1.5) * 5}deg)` }}><DistrictCard id={id} /></span>)}</div>
    </div>
  );
}
