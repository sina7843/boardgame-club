// Original UNO-style card faces (vector, no bitmap assets). Colour is never the only signal: every face carries
// the colour's Persian initial and a full spoken label.
import type { Card, Color } from './rules.ts';

export const COLOR_FA: Record<Color, string> = { r: 'قرمز', y: 'زرد', g: 'سبز', b: 'آبی' };
const COLOR_INITIAL: Record<Color, string> = { r: 'ق', y: 'ز', g: 'س', b: 'آ' };
const fa = (n: number) => n.toLocaleString('fa-IR');

export function cardLabel(c: Card): string {
  const color = c.color ? ` ${COLOR_FA[c.color]}` : '';
  switch (c.kind) {
    case 'num': return `${fa(c.value!)}${color}`;
    case 'skip': return `ردشدن${color}`;
    case 'rev': return `برگشت${color}`;
    case 'd2': return `+۲${color}`;
    case 'wild': return 'رنگی';
    case 'wd4': return 'رنگی +۴';
  }
}

function Symbol({ card, big }: { card: Card; big: boolean }) {
  const size = big ? 46 : 16;
  switch (card.kind) {
    case 'num': return <span className="uno-card__num" style={{ fontSize: big ? undefined : '0.95em' }}>{fa(card.value!)}</span>;
    case 'd2': return <span className="uno-card__num uno-card__num--small">+۲</span>;
    case 'wd4': return big ? <WildDisc plus /> : <span className="uno-card__num uno-card__num--small">+۴</span>;
    case 'wild': return big ? <WildDisc /> : <span aria-hidden="true">✦</span>;
    case 'skip':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M6.5 17.5 17.5 6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'rev':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 9h11l-3-3M19 15H8l3 3" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function WildDisc({ plus = false }: { plus?: boolean }) {
  return (
    <span className="uno-wild" aria-hidden="true">
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <path d="M20 20 L20 2 A18 18 0 0 1 38 20 Z" fill="var(--uno-r)" />
        <path d="M20 20 L38 20 A18 18 0 0 1 20 38 Z" fill="var(--uno-b)" />
        <path d="M20 20 L20 38 A18 18 0 0 1 2 20 Z" fill="var(--uno-y)" />
        <path d="M20 20 L2 20 A18 18 0 0 1 20 2 Z" fill="var(--uno-g)" />
      </svg>
      {plus && <span className="uno-wild__plus">+۴</span>}
    </span>
  );
}

/** A face-up card. `as="button"` makes it a hand card; otherwise it is a static picture with a label. */
export function CardFace({ card, size = 'md', state, onClick, disabled, hint }: {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  state?: 'playable' | 'selected' | 'dim';
  onClick?: () => void;
  disabled?: boolean;
  hint?: boolean;
}) {
  const cls = ['uno-card', `uno-card--${size}`, card.color ? `uno-card--${card.color}` : 'uno-card--wild', state ? `uno-card--${state}` : '', hint ? 'uno-card--hint' : ''].join(' ');
  const inner = (
    <>
      <span className="uno-card__corner uno-card__corner--start" aria-hidden="true"><Symbol card={card} big={false} /></span>
      <span className="uno-card__oval" aria-hidden="true"><Symbol card={card} big /></span>
      <span className="uno-card__corner uno-card__corner--end" aria-hidden="true"><Symbol card={card} big={false} /></span>
      {card.color && <span className="uno-card__initial" aria-hidden="true">{COLOR_INITIAL[card.color]}</span>}
    </>
  );
  if (!onClick) return <span className={cls} role="img" aria-label={cardLabel(card)}>{inner}</span>;
  return (
    <button type="button" className={cls} onClick={onClick} aria-disabled={disabled || undefined} aria-pressed={state === 'selected'}
      aria-label={`${cardLabel(card)}${disabled ? ' (قابل بازی نیست)' : ''}`}>
      {inner}
    </button>
  );
}

export function CardBack({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <span className={`uno-card uno-card--${size} uno-card--back`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="uno-card__oval uno-card__oval--back"><span className="uno-back__mark">اونو</span></span>
    </span>
  );
}
