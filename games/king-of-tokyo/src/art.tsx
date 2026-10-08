// Illustrated art for غول‌های شهر: comic-ink monster portraits (tinted by the --h hue), chunky dice glyphs, a skyline.
import type { ReactNode } from 'react';
import type { Face } from './rules.ts';

/* Shape classes: b = body hue, d = dark hue, l = light hue, w = white, k = ink. All strokes are thick ink. */
const PORTRAITS: ReactNode[] = [
  // 0 dragon
  <><path d="M13 25 6 5 24 15Z M51 25 58 5 40 15Z" className="m-l" /><path d="M10 32Q10 12 32 12T54 32Q54 44 47 49L44 60H20L17 49Q10 44 10 32Z" className="m-b" />
    <path d="M26 12 32 4 38 12Z" className="m-d" /><rect x="19" y="37" width="26" height="19" rx="9" className="m-l" /><circle cx="27" cy="45" r="2" className="m-k" /><circle cx="37" cy="45" r="2" className="m-k" />
    <path d="M14 28 30 32 27 38 16 36Z M50 28 34 32 37 38 48 36Z" className="m-w" /><circle cx="25" cy="34.5" r="2" className="m-k" /><circle cx="39" cy="34.5" r="2" className="m-k" />
    <path d="M24 53 26 57 28 53Z M36 53 38 57 40 53Z" className="m-w" /></>,
  // 1 robot
  <><path d="M32 12V4" className="m-line" /><circle cx="32" cy="4" r="3" className="m-d" /><rect x="6" y="26" width="6" height="16" rx="2" className="m-d" /><rect x="52" y="26" width="6" height="16" rx="2" className="m-d" />
    <rect x="11" y="12" width="42" height="42" rx="8" className="m-b" /><rect x="15" y="22" width="34" height="14" rx="6" className="m-k" /><rect x="18" y="25" width="10" height="8" rx="3" className="m-glow" /><rect x="36" y="25" width="10" height="8" rx="3" className="m-glow" />
    <rect x="20" y="42" width="24" height="8" rx="2" className="m-w" /><path d="M26 42V50M32 42V50M38 42V50" className="m-line" /><circle cx="16" cy="16" r="1.6" className="m-w" /><circle cx="48" cy="16" r="1.6" className="m-w" /></>,
  // 2 gorilla
  <><circle cx="9" cy="32" r="6" className="m-d" /><circle cx="55" cy="32" r="6" className="m-d" /><path d="M12 30Q12 8 32 8T52 30Q52 56 32 60T12 30Z" className="m-d" />
    <path d="M17 30Q17 22 32 22T47 30Q47 52 32 54T17 30Z" className="m-l" /><path d="M14 24Q32 14 50 24L48 29Q32 21 16 29Z" className="m-b" /><circle cx="25" cy="31" r="2.4" className="m-k" /><circle cx="39" cy="31" r="2.4" className="m-k" />
    <ellipse cx="32" cy="40" rx="8" ry="6" className="m-b" /><circle cx="29" cy="39" r="1.3" className="m-k" /><circle cx="35" cy="39" r="1.3" className="m-k" /><path d="M24 48Q32 53 40 48" className="m-line" /></>,
  // 3 sea monster
  <><path d="M8 40Q4 14 32 10T56 40Q56 50 50 52L52 62 44 54 40 62 34 54 30 62 24 54 20 62 14 54Q8 52 8 40Z" className="m-b" /><path d="M24 10 30 2 34 10 40 4 42 12Z" className="m-d" />
    <circle cx="22" cy="30" r="9" className="m-w" /><circle cx="42" cy="30" r="9" className="m-w" /><circle cx="24" cy="31" r="4.2" className="m-k" /><circle cx="40" cy="31" r="4.2" className="m-k" /><circle cx="25.5" cy="29.5" r="1.3" className="m-w" /><circle cx="41.5" cy="29.5" r="1.3" className="m-w" />
    <path d="M22 46Q32 52 42 46" className="m-line" /><circle cx="14" cy="46" r="1.6" className="m-l" /><circle cx="50" cy="46" r="1.6" className="m-l" /><circle cx="20" cy="56" r="1.4" className="m-l" /><circle cx="44" cy="56" r="1.4" className="m-l" /></>,
  // 4 giant bat
  <><path d="M14 30 4 4 26 16Z M50 30 60 4 38 16Z" className="m-d" /><path d="M14 26 8 10 22 18Z M50 26 56 10 42 18Z" className="m-l" /><path d="M10 36Q10 16 32 16T54 36Q54 52 32 60T10 36Z" className="m-b" />
    <path d="M17 29 29 33 27 38 18 36Z M47 29 35 33 37 38 46 36Z" className="m-k" /><circle cx="25" cy="34.5" r="1.8" className="m-glow" /><circle cx="39" cy="34.5" r="1.8" className="m-glow" />
    <path d="M28 42H36L32 47Z" className="m-d" /><path d="M20 48Q32 56 44 48L40 52 36 50 32 54 28 50 24 52Z" className="m-w" /><path d="M25 49 26.5 55 28 50Z M36 50 37.5 55 39 49Z" className="m-w" /></>,
  // 5 dinosaur
  <><path d="M20 14 24 4 30 12 36 2 40 12 46 6 46 16Z" className="m-d" /><path d="M12 30Q12 12 34 12T54 28L54 48Q54 58 44 58H20Q12 52 12 30Z" className="m-b" />
    <path d="M26 38H56V54H26Z" className="m-l" /><path d="M26 38H56V54H26Z" className="m-line" /><circle cx="50" cy="43" r="1.8" className="m-k" /><circle cx="44" cy="43" r="1.4" className="m-k" />
    <path d="M28 54 30 49 33 54 36 49 39 54 42 49 45 54 48 49 51 54Z" className="m-w" /><circle cx="26" cy="26" r="6" className="m-w" /><circle cx="27" cy="27" r="2.8" className="m-k" /><path d="M18 20 32 24" className="m-line" /></>,
];

export function Monster({ k, className = '' }: { k: number; className?: string }) {
  return <svg viewBox="0 0 64 64" className={`kt-art ${className}`} aria-hidden="true">{PORTRAITS[k % 6]}</svg>;
}

const num = (n: string, c: string) => <text x="32" y="46" textAnchor="middle" className={`d-num ${c}`}>{n}</text>;
const GLYPH: Record<Face, ReactNode> = {
  '1': num('۱', 'd-ink'), '2': num('۲', 'd-ink'), '3': num('۳', 'd-ink'),
  heart: <path d="M32 54C10 38 12 16 24 16c5 0 8 3 8 6 0-3 3-6 8-6 12 0 14 22-8 38Z" className="d-heart" />,
  bolt: <path d="M37 8 16 36h12l-4 20 24-30H35Z" className="d-bolt" />,
  claw: <path d="M14 10C24 22 24 40 18 56M30 8C40 22 40 42 34 58M46 10C54 24 54 40 50 54" className="d-claw" />,
};

export function DieGlyph({ f }: { f: Face }) {
  return <svg viewBox="0 0 64 64" className="kt-glyph" aria-hidden="true">{GLYPH[f]}</svg>;
}

// Layered night skyline: far towers, near blocks with lit windows, a broadcast tower and a moon.
export function Skyline() {
  return (
    <svg className="kt__skyline" viewBox="0 0 400 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><pattern id="kt-win" width="8" height="10" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="3" height="4" fill="#ffd23f" opacity="0.85" /></pattern></defs>
      <circle cx="330" cy="26" r="14" fill="#fff3c4" opacity="0.9" /><circle cx="324" cy="22" r="14" fill="#2a1f5a" opacity="0.55" />
      <path d="M0 100V58H24V40H46V64H62V46H88V70H110V52H140V74H170V44H196V66H224V50H252V72H280V42H306V62H336V48H362V70H400V100Z" fill="#241a52" />
      <path d="M60 100V70H84V52H108V100ZM150 100V60H176V100ZM200 100 204 34 208 100Z M196 100V52H216V100ZM250 100V66H282V50H306V100ZM340 100V62H372V100Z M0 100V76H30V100Z" fill="#0c0820" />
      <path d="M60 100V70H84V52H108V100ZM150 100V60H176V100ZM250 100V66H282V50H306V100ZM340 100V62H372V100Z" fill="url(#kt-win)" />
      <path d="M204 34V16M198 24H210" stroke="#ff3d7f" strokeWidth="1.5" /><circle cx="204" cy="15" r="2" fill="#ff3d7f" />
    </svg>
  );
}

export const Bolt = () => <svg viewBox="0 0 24 24" className="kt-bolt" aria-hidden="true"><path d="M14 2 5 14h6l-2 8 10-13h-6Z" fill="currentColor" stroke="#14102a" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
