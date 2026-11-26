// Original UNO-style card faces: vector numbers/corners, painted centre art for action and wild cards (WebP cut from a
// generated sprite sheet, see DECISIONS.md). Colour is never the only signal: every face carries
// the colour's Persian initial and a full spoken label.
import type { CSSProperties } from 'react';
import { tx, useTermsLang } from '@bg/ui';
import { terms } from './terms.ts';
import type { Card, Color } from './rules.ts';
import skipArt from './art/uno-skip.webp';
import reverseArt from './art/uno-reverse.webp';
import draw2Art from './art/uno-draw2.webp';
import wildArt from './art/uno-wild.webp';
import wild4Art from './art/uno-wild4.webp';
import backPng from './art/uno-back.png';
import bNum8 from './art/uno-b-num-8.png';
import bRev from './art/uno-b-rev.png';
import gNum1 from './art/uno-g-num-1.png';
import gNum5 from './art/uno-g-num-5.png';
import rNum3 from './art/uno-r-num-3.png';
import rNum5 from './art/uno-r-num-5.png';
import rSkip from './art/uno-r-skip.png';
import wd4Png from './art/uno-wd4.png';
import wildPng from './art/uno-wild.png';
import yD2 from './art/uno-y-d2.png';

// Delivered card faces (design/games/group-c/art/uno). The handoff ships only these 10 faces; every other face keeps the
// vector fallback below until its art arrives (listed in the report).
const FACE_ART: Record<string, string> = { 'b-num-8': bNum8, 'b-rev': bRev, 'g-num-1': gNum1, 'g-num-5': gNum5, 'r-num-3': rNum3, 'r-num-5': rNum5, 'r-skip': rSkip, wd4: wd4Png, wild: wildPng, 'y-d2': yD2 };
const faceKey = (c: Card) => (c.kind === 'wild' || c.kind === 'wd4' ? c.kind : `${c.color}-${c.kind === 'num' ? `num-${c.value}` : c.kind}`);

const CENTRE_ART: Partial<Record<Card['kind'], string>> = { skip: skipArt, rev: reverseArt, d2: draw2Art, wild: wildArt, wd4: wild4Art };
const ACTION_KINDS = new Set<Card['kind']>(['skip', 'rev', 'd2']);

export const COLOR_FA: Record<Color, string> = { r: 'قرمز', y: 'زرد', g: 'سبز', b: 'آبی' };
const COLOR_INITIAL: Record<Color, string> = { r: 'ق', y: 'ز', g: 'س', b: 'آ' };
const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');

export function cardLabel(c: Card): string {
  const color = c.color ? ` ${COLOR_FA[c.color]}` : '';
  switch (c.kind) {
    case 'num': return `${fa(c.value!)}${color}`;
    case 'skip': return `${tx(terms.skip)}${color}`;
    case 'rev': return `${tx(terms.reverse)}${color}`;
    case 'd2': return `+۲${color}`;
    case 'wild': return tx(terms.wild);
    case 'wd4': return tx(terms.wildDrawFour);
  }
}

/** Colour-blind cue next to the initial: diamond (red), star (yellow), triangle (green), circle (blue). */
function Pip({ c }: { c: Color }) {
  const d = { r: 'M8 1 15 8 8 15 1 8Z', y: 'M8 .6 10 6 15.4 8 10 10 8 15.4 6 10 .6 8 6 6Z', g: 'M8 1.5 15 14H1Z', b: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Z' }[c];
  return <svg className="uno-pip" viewBox="0 0 16 16" aria-hidden="true"><path d={d} fill="currentColor" stroke="#fdf6e3" strokeWidth="1.6" strokeLinejoin="round" paintOrder="stroke" /></svg>;
}

function Symbol({ card, big }: { card: Card; big: boolean }) {
  const art = big ? CENTRE_ART[card.kind] : undefined;
  if (art) return <img className="uno-art" src={art} alt="" draggable={false} />;
  const size = 16;
  switch (card.kind) {
    case 'num': return <span className="uno-card__num" style={{ fontSize: big ? undefined : '0.95em' }}>{fa(card.value!)}</span>;
    case 'd2': return <span className="uno-card__num uno-card__num--small">+۲</span>;
    case 'wd4': return <span className="uno-card__num uno-card__num--small">+۴</span>;
    case 'wild': return <span aria-hidden="true">✦</span>;
    case 'skip':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="uno-icon">
          <circle cx="12" cy="12" r="8.6" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="3.8" />
          <path d="M5.8 18.2 18.2 5.8" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" />
        </svg>
      );
    case 'rev':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="uno-icon">
          <path d="M3 8.5h11" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M13 3.6 21.4 8.5 13 13.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M21 15.5H10" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M11 10.6 2.6 15.5 11 20.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
  }
}

/** A face-up card. `as="button"` makes it a hand card; otherwise it is a static picture with a label. */
export function CardFace({ card, size = 'md', state, onClick, disabled, hint, style, flip, flipFrom }: {
  /** Shared motion: stable id so the card glides between zones, and where a new card comes from. */
  flip?: string;
  flipFrom?: string;
  style?: CSSProperties;
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  state?: 'playable' | 'selected' | 'dim';
  onClick?: () => void;
  disabled?: boolean;
  hint?: boolean;
}) {
  useTermsLang();
  const art = FACE_ART[faceKey(card)];
  const cls = ['uno-card', `uno-card--${size}`, art ? 'uno-card--img' : '', card.color ? `uno-card--${card.color}` : 'uno-card--wild', state ? `uno-card--${state}` : '', hint ? 'uno-card--hint' : ''].join(' ');
  const inner = art ? <img className="uno-face" src={art} alt="" draggable={false} /> : (
    <>
      <span className="uno-card__corner uno-card__corner--start" aria-hidden="true"><Symbol card={card} big={false} /></span>
      <span className={ACTION_KINDS.has(card.kind) ? 'uno-card__oval uno-card__oval--act' : 'uno-card__oval'} aria-hidden="true"><Symbol card={card} big /></span>
      <span className="uno-card__corner uno-card__corner--end" aria-hidden="true"><Symbol card={card} big={false} /></span>
      {card.color && <span className="uno-card__initial" aria-hidden="true"><Pip c={card.color} />{COLOR_INITIAL[card.color]}</span>}
      <span className="uno-card__sheen" aria-hidden="true" />
    </>
  );
  if (!onClick) return <span className={cls} role="img" aria-label={cardLabel(card)} style={style} data-flip={flip} data-flip-from={flipFrom}>{inner}</span>;
  return (
    <button type="button" className={cls} style={style} data-flip={flip} data-flip-from={flipFrom} onClick={onClick} aria-disabled={disabled || undefined} aria-pressed={state === 'selected'}
      aria-label={`${cardLabel(card)}${disabled ? tx(terms.notPlayable) : ''}`}>
      {inner}
    </button>
  );
}

export function CardBack({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <span className={`uno-card uno-card--${size} uno-card--back uno-card--img`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <img className="uno-face" src={backPng} alt="" draggable={false} />
    </span>
  );
}
