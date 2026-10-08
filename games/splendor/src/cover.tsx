// Catalog cover: oxblood velvet with a cameo noble, two engraved cards and a scatter of faceted gem coins.
import { Chip, DevCard, NobleTile } from './renderer.tsx';

export default function SplendorCover({ title }: { title: string }) {
  const at = (x: string, y: string, el: React.ReactNode, r = 0, w?: string) => <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg)`, inlineSize: w }}>{el}</span>;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="sp"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', padding: 0, borderRadius: 0,
        background: 'radial-gradient(circle at 50% 35%, #6a2237, #2b0f18 75%)' }}>
      {at('8%', '14%', <NobleTile id={7} />, -6)}
      {at('40%', '10%', <DevCard id={86} />, 4, '22%')}
      {at('64%', '20%', <DevCard id={52} />, -5, '22%')}
      {at('12%', '62%', <Chip t="r" />, 0)}{at('26%', '58%', <Chip t="u" />, 0)}{at('40%', '66%', <Chip t="o" />, 0)}{at('86%', '66%', <Chip t="g" />, 0)}
    </div>
  );
}
