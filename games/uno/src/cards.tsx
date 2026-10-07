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
    case 'd2': return big ? <MiniCards colors={['currentColor', 'currentColor']} label="+۲" /> : <span className="uno-card__num uno-card__num--small">+۲</span>;
    case 'wd4': return big ? <MiniCards colors={['var(--uno-r)', 'var(--uno-y)', 'var(--uno-g)', 'var(--uno-b)']} label="+۴" /> : <span className="uno-card__num uno-card__num--small">+۴</span>;
    case 'wild': return big ? <WildDisc /> : <span aria-hidden="true">✦</span>;
    case 'skip':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="uno-icon">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <path d="M6.2 17.8 17.8 6.2" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );
    case 'rev':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="uno-icon">
          <path d="M4 8.5h12.5M13 4.8l3.8 3.7-3.8 3.7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 15.5H7.5M11 11.8l-3.8 3.7 3.8 3.7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

/** Stacked mini cards (Draw Two: two; Wild Draw Four: four, one per colour) with the penalty in the middle. */
function MiniCards({ colors, label }: { colors: string[]; label: string }) {
  const n = colors.length;
  return (
    <span className="uno-minis" aria-hidden="true">
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        {colors.map((fill, i) => {
          const t = n === 1 ? 0 : i / (n - 1) - 0.5;
          return (
            <g key={i} transform={`translate(20 22) rotate(${t * (n === 2 ? 36 : 54)}) translate(${t * (n === 2 ? 8 : 10)} 0)`}>
              <rect x="-7" y="-11" width="14" height="21" rx="2.4" fill={fill} stroke="#fff" strokeWidth="1.6" />
              <rect x="-4.4" y="-8.4" width="8.8" height="16" rx="4" fill="#fff" opacity="0.28" />
            </g>
          );
        })}
      </svg>
      <span className="uno-minis__n">{label}</span>
    </span>
  );
}

function WildDisc({ plus = false }: { plus?: boolean }) {
  return (
    <span className="uno-wild" aria-hidden="true">
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        <path d="M20 20 L20 2 A18 18 0 0 1 38 20 Z" fill="var(--uno-r)" />
        <path d="M20 20 L38 20 A18 18 0 0 1 20 38 Z" fill="var(--uno-b)" />
        <path d="M20 20 L20 38 A18 18 0 0 1 2 20 Z" fill="var(--uno-y)" />
        <path d="M20 20 L2 20 A18 18 0 0 1 20 2 Z" fill="var(--uno-g)" />
        <circle cx="20" cy="20" r="18" fill="none" stroke="#fff" strokeWidth="1.6" />
        <path d="M20 2v36M2 20h36" stroke="#fff" strokeWidth="1.2" opacity="0.85" />
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
      <span className="uno-card__sheen" aria-hidden="true" />
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
      <span className="uno-card__frame" aria-hidden="true" />
      <span className="uno-card__oval uno-card__oval--back"><span className="uno-back__mark">اونو</span></span>
      <span className="uno-card__sheen" aria-hidden="true" />
    </span>
  );
}
