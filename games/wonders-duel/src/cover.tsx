// Catalog cover: a golden wonder over a small age pyramid of coloured cards.
import { CardFace, WonderPlate } from './renderer.tsx';

export default function WondersDuelCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="wd"
      style={{ display: 'grid', placeItems: 'center', gap: 6, inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 30%, #2a4d93, #0e1c3a)' }}>
      <WonderPlate id={8} built />
      <div style={{ display: 'flex', gap: 4 }}>{[17, 13, 9].map((id) => <CardFace key={id} id={id} />)}</div>
    </div>
  );
}
