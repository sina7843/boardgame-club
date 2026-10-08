// Catalog cover: a crate of vegetables beside a chalkboard rule card.
import { RuleCard, VegIcon } from './renderer.tsx';

export default function PointSaladCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="ps"
      style={{ position: 'relative', display: 'flex', gap: '6%', alignItems: 'center', justifyContent: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden',
        background: 'repeating-linear-gradient(0deg, #a87a45 0 14px, #8f6638 14px 16px)' }}>
      <span style={{ transform: 'rotate(-5deg)', inlineSize: '34%' }}><RuleCard id={23} /></span>
      <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 4 }}>
        {(['tomato', 'carrot', 'lettuce', 'onion', 'cabbage', 'pepper'] as const).map((v) => <VegIcon key={v} v={v} size={2.6} />)}
      </span>
    </div>
  );
}
