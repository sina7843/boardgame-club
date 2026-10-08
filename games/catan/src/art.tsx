// Catan art: painted terrain hexes, ocean, robber, harbor badge, resource and development card art (WebP, cut from a
// generated sheet — see DECISIONS.md), framed in code, plus the board's wood/brass/token defs and CSS dice faces.
// Purely decorative: every part is aria-hidden or sits inside an element that already carries the accessible label.
import { useId } from 'react';
import type { Res, Terrain } from './board.ts';
import hexForest from './art/hex-forest.webp';
import hexHills from './art/hex-hills.webp';
import hexPasture from './art/hex-pasture.webp';
import hexFields from './art/hex-fields.webp';
import hexMountains from './art/hex-mountains.webp';
import hexDesert from './art/hex-desert.webp';
import harbor from './art/harbor.webp';
import robber from './art/robber.webp';
import ocean from './art/bd-ocean.webp';
import resLumber from './art/res-lumber.webp';
import resBrick from './art/res-brick.webp';
import resWool from './art/res-wool.webp';
import resGrain from './art/res-grain.webp';
import resOre from './art/res-ore.webp';
import devKnight from './art/dev-knight.webp';
import devVp from './art/dev-vp.webp';
import devRoad from './art/dev-road.webp';
import devMonopoly from './art/dev-monopoly.webp';
import devPlenty from './art/dev-plenty.webp';
import cardBack from './art/card-back.webp';

const HEX: Record<Terrain, string> = { forest: hexForest, hills: hexHills, pasture: hexPasture, fields: hexFields, mountains: hexMountains, desert: hexDesert };
const RES: Record<Res, string> = { lumber: resLumber, brick: resBrick, wool: resWool, grain: resGrain, ore: resOre };
export const DEV_ART = { knight: devKnight, vp: devVp, road: devRoad, monopoly: devMonopoly, plenty: devPlenty };
export const CARD_BACK = cardBack;

/** Wood, brass, ivory-token and shadow defs for the board and cover; render once inside the <svg>. */
export function BoardDefs() {
  return (
    <defs>
      <linearGradient id="ctb-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b98251" /><stop offset="0.5" stopColor="#7d5029" /><stop offset="1" stopColor="#5a3819" /></linearGradient>
      <pattern id="ctb-grain" width="64" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">
        <path d="M0 2 H64" stroke="#2c1706" strokeOpacity="0.28" strokeWidth="0.7" />
        <path d="M0 5 Q16 3.6 32 5 T64 5" fill="none" stroke="#e8c08c" strokeOpacity="0.2" strokeWidth="0.8" />
      </pattern>
      <radialGradient id="ctb-brass" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff2b8" /><stop offset="0.5" stopColor="#d1a23c" /><stop offset="1" stopColor="#7a5a14" /></radialGradient>
      <linearGradient id="ctb-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.38" /></linearGradient>
      <radialGradient id="ctb-token" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#fffbed" /><stop offset="0.6" stopColor="#efe3c3" /><stop offset="1" stopColor="#c9b583" /></radialGradient>
      <filter id="ctb-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="1" dy="3" stdDeviation="2.4" floodColor="#001a2b" floodOpacity="0.45" /></filter>
      <filter id="ctb-soft" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0.8" dy="1.6" stdDeviation="1" floodColor="#000" floodOpacity="0.5" /></filter>
    </defs>
  );
}

/** Painted ocean filling a polygon (`box` is the half-size of the square the image covers). */
export function Ocean({ points, box }: { points: string; box: number }) {
  const clip = useId();
  return (
    <g aria-hidden="true" pointerEvents="none">
      <clipPath id={clip}><polygon points={points} /></clipPath>
      <image href={ocean} x={-box} y={-box} width={box * 2} height={box * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
    </g>
  );
}

/** Painted pointy-top terrain hex of circumradius `r` centred on (cx, cy), clipped to the exact hex so tiles meet cleanly. */
export function HexArt({ terrain, cx, cy, r, className }: { terrain: Terrain; cx: number; cy: number; r: number; className?: string }) {
  const clip = useId();
  const pts = Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const size = r * 2.3; // the painted hex fills ~224 of 256 px vertically; the image centre of the hex is (129.5, 130)
  return (
    <g className={className} aria-hidden="true" pointerEvents="none">
      <clipPath id={clip}><polygon points={pts} /></clipPath>
      <image href={HEX[terrain]} x={cx - size * 0.506} y={cy - size * 0.508} width={size} height={size} clipPath={`url(#${clip})`} preserveAspectRatio="none" />
    </g>
  );
}

/** Harbor dock badge centred on (x, y). */
export function HarborArt({ x, y }: { x: number; y: number }) {
  return <image href={harbor} x={x - 32} y={y - 32} width="64" height="64" aria-hidden="true" pointerEvents="none" />;
}

/** Robber figure; its base sits on the origin, ~40 units tall. */
export function RobberPawn() {
  return <image className="ct-robber__body" href={robber} x="-20" y="-30" width="40" height="40" />;
}

/** Painted resource card art as a square image (alt is empty: the parent carries the label). */
export function ResIcon({ r }: { r: Res }) {
  return <img src={RES[r]} alt="" aria-hidden="true" draggable={false} className="ct-ico" />;
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** CSS-drawn die face (3x3 pip grid). Decorative: the parent carries the label. */
export function DieFace({ value, red }: { value: number; red?: boolean }) {
  return (
    <span aria-hidden="true" className={red ? 'ct-die ct-die--red' : 'ct-die'}>
      {Array.from({ length: 9 }, (_, k) => <i key={k} className={PIPS[value]?.includes(k) ? 'ct-die__pip' : ''} />)}
    </span>
  );
}
