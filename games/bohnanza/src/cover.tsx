// Catalog cover: a fan of seed-packet bean cards over furrowed soil.
import { BeanCard } from './renderer.tsx';

export default function BohnanzaCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="bn"
      style={{ display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'repeating-linear-gradient(0deg, #5a3a22 0 10px, #4a2f1c 10px 20px)' }}>
      <div style={{ display: 'flex' }}>
        {(['chili', 'blackeye', 'blue', 'garden', 'soy'] as const).map((b, i) => (
          <span key={b} style={{ marginInline: -8, transform: `rotate(${(i - 2) * 9}deg) translateY(${Math.abs(i - 2) * 6}px)` }}><BeanCard b={b} /></span>
        ))}
      </div>
    </div>
  );
}
