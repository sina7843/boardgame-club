// Catalog cover: an order card and a trade card on sandstone with heaps of spice cubes.
import { Cubes, MerchantCard, OrderCard } from './renderer.tsx';

export default function CenturyCover({ title }: { title: string }) {
  const at = (x: string, y: string, el: React.ReactNode, r: number, w: string) => <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg)`, inlineSize: w }}>{el}</span>;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="ct"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 30%, #8a5a2a, #2a1708)' }}>
      {at('12%', '16%', <OrderCard id={30} />, -8, '22%')}{at('40%', '12%', <MerchantCard id={18} />, 4, '20%')}{at('66%', '20%', <MerchantCard id={7} />, 10, '20%')}
      {at('20%', '68%', <Cubes bag={{ y: 3, r: 2, g: 2, b: 1 }} />, 0, 'auto')}
    </div>
  );
}
