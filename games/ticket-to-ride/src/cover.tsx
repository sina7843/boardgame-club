// Catalog cover: the North American railway chart (coasts, lakes, mountains, coloured routes, a few claimed trains),
// the title cartouche and a fan of train cards. Vector only; shares map defs, layout and art.
import { BOARDS } from './board.ts';
import { layoutOf } from './geometry.ts';
import { Car, CardArt, Cartouche, MapDefs, colorIx } from './art.tsx';

/** A few claimed routes for decoration: route index → seat. */
const OWNED: Record<number, number> = { 13: 0, 21: 0, 33: 1, 45: 2, 58: 3, 66: 1, 25: 2 };

export default function TtrCover({ title }: { title: string }) {
  const L = layoutOf('usa');
  const B = BOARDS.usa;
  const T = L.terrain;
  const S = 0.3;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <MapDefs map="usa" />
      <rect width="320" height="180" fill="url(#ttr-sea)" />
      <rect width="320" height="180" fill="url(#ttr-waves)" />
      <g transform={`translate(4 ${(180 - L.h * S) / 2 - 4}) scale(${S})`}>
        {[22, 12].map((w, i) => <path key={i} d={`${T.land} ${T.islands}`} fill="none" stroke="#eef6ef" strokeOpacity={0.15 + i * 0.15} strokeWidth={w} />)}
        <path d={T.land} fill="url(#ttr-land)" stroke="#3b2a17" strokeWidth="2.4" />
        <path d={T.water} fill="url(#ttr-sea)" stroke="#3b2a17" strokeWidth="1.6" />
        {T.mountains.map((p, i) => <use key={i} href="#ttr-mtn" x={p.x - 12 * p.s} y={p.y - 10 * p.s} width={24 * p.s} height={15 * p.s} />)}
        {B.routes.map((r, i) => L.routes[i]!.slots.map((s, k) => (
          <g key={`${i}-${k}`} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.angle.toFixed(1)})`}>
            {OWNED[i] !== undefined ? <Car len={s.len} seat={OWNED[i]!} /> : <rect x={-s.len / 2} y="-5" width={s.len} height="10" rx="2" fill={`url(#ttr-c-${colorIx(r.color)})`} stroke="#1c140b" />}
          </g>
        )))}
        {L.cities.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="9" fill="url(#ttr-station)" stroke="#2b1a0b" strokeWidth="2.2" /><circle cx={x} cy={y} r="3.5" fill="#8e2f1f" /></g>)}
      </g>
      <g transform="translate(92 154) scale(0.82)"><Cartouche title="بلیت قطار" sub="آمریکا · اروپا · ایران" /></g>
      {[[0, 236, 84, -14], [8, 256, 80, -2], [4, 276, 82, 10]].map(([c, x, y, r]) => (
        <g key={c} transform={`translate(${x} ${y}) rotate(${r})`} filter="url(#ttr-landshadow)"><svg x="-19" y="-28" width="38" height="57"><CardArt c={c!} /></svg></g>
      ))}
      <rect x="1.5" y="1.5" width="317" height="177" fill="none" stroke="#3b2a17" strokeWidth="3" />
      <rect x="5" y="5" width="310" height="170" fill="none" stroke="#f3e7c6" strokeOpacity="0.7" strokeWidth="0.8" />
    </svg>
  );
}
