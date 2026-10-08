// Catalog cover: an estate agent's desk — a domed palace card, a reed hut card and a green cheque on walnut.
import { Cheque, Prop } from './renderer.tsx';

export default function ForSaleCover({ title }: { title: string }) {
  return (
    <div {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className="fs fs-cover"
      style={{ position: 'relative', inlineSize: '100%', blockSize: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 30%, #6b4a2b, #2a1a0e)', display: 'block' }}>
      <span style={{ position: 'absolute', insetInlineStart: '18%', insetBlockStart: '22%', transform: 'rotate(8deg)' }}><Prop v={3} /></span>
      <span style={{ position: 'absolute', insetInlineStart: '40%', insetBlockStart: '12%', transform: 'rotate(-4deg) scale(1.1)' }}><Prop v={30} /></span>
      <span style={{ position: 'absolute', insetInlineStart: '64%', insetBlockStart: '48%', transform: 'rotate(-10deg)' }}><Cheque v={15} /></span>
    </div>
  );
}
