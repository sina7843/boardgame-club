// Catalog cover: a face-down card slid across plum felt between a fan of creature cards.
import { CritterCard } from './renderer.tsx';

export default function CockroachPokerCover({ title }: { title: string }) {
  const at = (x: string, y: string, el: React.ReactNode, r: number) => <span style={{ position: 'absolute', insetInlineStart: x, insetBlockStart: y, transform: `rotate(${r}deg)` }}>{el}</span>;
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="cr"
      style={{ position: 'relative', display: 'block', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #4a2a4a, #170c17)' }}>
      {at('10%', '20%', <CritterCard c="cockroach" />, -14)}{at('24%', '14%', <CritterCard c="scorpion" />, -4)}{at('38%', '18%', <CritterCard c="rat" />, 8)}
      {at('64%', '30%', <CritterCard back size="md" />, 18)}
    </div>
  );
}
