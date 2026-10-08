// Unmatched art: painted character portraits, card-type seals and arena backdrops (WebP, cropped from two generated
// sprite sheets — see DECISIONS.md), framed in code. Everything here is decorative: callers mark it aria-hidden and
// keep the accessible text themselves.
import { useId } from 'react';
import arthur from './art/arthur.webp';
import merlin from './art/merlin.webp';
import medusa from './art/medusa.webp';
import harpy from './art/harpy.webp';
import sinbad from './art/sinbad.webp';
import porter from './art/porter.webp';
import alice from './art/alice.webp';
import jabberwock from './art/jabberwock.webp';
import holmes from './art/holmes.webp';
import watson from './art/watson.webp';
import dracula from './art/dracula.webp';
import sister from './art/sister.webp';
import jekyll from './art/jekyll.webp';
import invisible from './art/invisible.webp';
import typeAttack from './art/type-attack.webp';
import typeDefense from './art/type-defense.webp';
import typeScheme from './art/type-scheme.webp';
import typeVersatile from './art/type-versatile.webp';
import arenaMarmoreal from './art/arena-marmoreal.webp';
import arenaSarpedon from './art/arena-sarpedon.webp';
import arenaSoho from './art/arena-soho.webp';
import arenaBaskerville from './art/arena-baskerville-manor.webp';

const INK = '#1d1812', PAPER = '#f6efdc';

/** Portrait per emblem id (Jekyll and Hyde share the split-face portrait). */
export const PORTRAITS: Record<string, string> = {
  arthur, merlin, medusa, harpy, sinbad, porter, alice, jabberwock, holmes, watson, dracula, sister, jekyll, hyde: jekyll, invisible
};
const TYPE_SEAL: Record<string, string> = { attack: typeAttack, defense: typeDefense, scheme: typeScheme, versatile: typeVersatile };
const ARENAS: Record<string, string> = { marmoreal: arenaMarmoreal, sarpedon: arenaSarpedon, soho: arenaSoho, 'baskerville-manor': arenaBaskerville };

/** Which emblem a fighter wears: the hero, or that hero's sidekick type. */
export const SIDEKICK_EMBLEM: Record<string, string> = { arthur: 'merlin', medusa: 'harpy', sinbad: 'porter', alice: 'jabberwock', holmes: 'watson', dracula: 'sister' };

/** A fighter's portrait clipped to a circle in a -30..30 box (`c`, the hero colour, is kept for callers' frames). */
export function Emblem({ id }: { id: string; c?: string }) {
  const clip = useId();
  return (
    <g>
      <clipPath id={clip}><circle r="30" /></clipPath>
      <image href={PORTRAITS[id] ?? arthur} x="-30" y="-30" width="60" height="60" clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
    </g>
  );
}

/** Round portrait in the hero colour; an optional ring is the hero's health dial (pct 0-100). */
export function Portrait({ id, color, size = 56, pct }: { id: string; color: string; size?: number; pct?: number }) {
  return (
    <svg className="um-portrait" viewBox="-40 -40 80 80" width={size} height={size} aria-hidden="true" focusable="false">
      {pct !== undefined && <>
        <circle r="36" fill="none" stroke="rgb(0 0 0 / 0.28)" strokeWidth="5" />
        <circle r="36" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(0, pct)} 100`} transform="rotate(-90)" />
      </>}
      <circle r="31" fill={color} stroke="#fff" strokeWidth="2" />
      <g transform="scale(.9)"><Emblem id={id} /></g>
      <circle r="27" fill="none" stroke={INK} strokeWidth="1.5" />
    </svg>
  );
}

/** Illustrated art window of a card (viewBox 120x64): the owner's painted portrait, bled to the edges, with the type seal. */
export function CardArt({ type, emblem, color }: { type: string; emblem: string; color: string }) {
  const shade = useId();
  return (
    <svg className="um-card__art" viewBox="0 0 120 64" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={shade} x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.45" /></linearGradient></defs>
      <rect width="120" height="64" fill={color} />
      <image href={PORTRAITS[emblem] ?? arthur} x="0" y="-22" width="120" height="120" preserveAspectRatio="xMidYMid slice" />
      <rect width="120" height="64" fill={`url(#${shade})`} />
      <g transform="translate(15 49)">
        <circle r="12.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
        <image href={TYPE_SEAL[type] ?? typeAttack} x="-12" y="-12" width="24" height="24" />
      </g>
    </svg>
  );
}

// ---------- battlefield scenery (1337 x 866) ----------

/** Footpath palette per map: outline, trodden surface and stepping stones. */
export const PATHS: Record<string, { edge: string; fill: string; stone: string }> = {
  marmoreal: { edge: '#7d705a', fill: '#d6c8a2', stone: '#f1e7cb' },
  sarpedon: { edge: '#7c5a2e', fill: '#dbbb80', stone: '#f3deaa' },
  soho: { edge: '#1d1c22', fill: '#7c786c', stone: '#a6a294' },
  'baskerville-manor': { edge: '#2a2418', fill: '#97835c', stone: '#bba97f' }
};

/** The painted arena behind the space network. */
export const Scenery = ({ boardId }: { boardId: string }) => (
  <image href={ARENAS[boardId] ?? arenaMarmoreal} width="1337" height="866" preserveAspectRatio="xMidYMid slice" />
);
