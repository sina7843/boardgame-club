// Catalog cover: plates riding a conveyor belt — maki, nigiri on wasabi, tempura and a pudding.
import { Plate } from './renderer.tsx';

export default function SushiGoCover({ title }: { title: string }) {
  const at = (x: string, y: string, k: Parameters<typeof Plate>[0]['k'], wasabi?: boolean) => (
    <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y }}><Plate k={k} size="md" wasabi={wasabi} /></span>
  );
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="sg"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'linear-gradient(180deg, #e9d3a8 0 38%, #3b3f45 38% 86%, #22252a 86%)' }}>
      {at('6%', '30%', 'maki3')}{at('30%', '26%', 'squid', true)}{at('54%', '30%', 'tempura')}{at('77%', '26%', 'pudding')}
    </div>
  );
}
