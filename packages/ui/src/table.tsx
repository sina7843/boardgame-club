// Table-level shared components (docs/DESIGN_SYSTEM.md): PlayerSeat, TurnIndicator, ActionBar, Token, Hand.
// Game-specific boards live in each game's renderer; these stay game-agnostic.
import type { ReactNode } from 'react';
import { Avatar } from './components.tsx';
import { Icon } from './icons.tsx';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function PlayerSeat({ name, avatarKey, label, active, done, me, children }: {
  name: string; avatarKey: string; label?: string; active?: boolean; done?: boolean; me?: boolean; children?: ReactNode;
}) {
  return (
    <div className={cx('seat', active && 'seat--active', me && 'seat--me')} aria-current={active ? 'true' : undefined}>
      <Avatar avatarKey={avatarKey} name={name} size={40} />
      <div className="seat__body">
        <div className="seat__name"><bdi>{name}</bdi>{me && <span className="seat__me">(شما)</span>}</div>
        {label && <div className="seat__label">{label}</div>}
        {children}
      </div>
      {active && <span className="seat__state" title="در انتظار حرکت"><Icon name="clock" size={18} /><span className="visually-hidden">در انتظار حرکت</span></span>}
      {done && <span className="seat__state seat__state--done" title="ثبت شد"><Icon name="star" size={18} /><span className="visually-hidden">ثبت شد</span></span>}
    </div>
  );
}

/** Text + icon + color: never color alone (NFR-06). */
export function TurnIndicator({ tone, children }: { tone: 'mine' | 'wait' | 'done' | 'pending'; children: ReactNode }) {
  const icon = tone === 'mine' ? 'play' : tone === 'done' ? 'star' : 'clock';
  return <div className={`turn turn--${tone}`} role="status" aria-live="polite"><Icon name={icon} size={18} />{children}</div>;
}

export function ActionBar({ children, label = 'اقدام‌ها' }: { children: ReactNode; label?: string }) {
  return <div className="actionbar" role="toolbar" aria-label={label}>{children}</div>;
}

export function Token({ value, selected, disabled, onSelect, label }: {
  value: number; selected?: boolean; disabled?: boolean; onSelect?: () => void; label?: string;
}) {
  return (
    <button type="button" className={cx('token', selected && 'token--selected')} aria-pressed={selected} disabled={disabled}
      onClick={onSelect} aria-label={label ?? `ژتون ${value.toLocaleString('fa-IR')}`}>
      {value.toLocaleString('fa-IR')}
    </button>
  );
}

export function Hand({ label, children }: { label: string; children: ReactNode }) {
  return <div className="hand" role="group" aria-label={label}>{children}</div>;
}

/** Contract between the table shell and a game renderer bundle (games/*\/src/renderer.tsx). */
export interface GameAction { type: string; [key: string]: unknown }
export interface GameRendererProps<View> {
  view: View;
  legalActions: GameAction[];
  mySeat: number | null;
  seatName: (seat: number) => string;
  /** A command is in flight or unconfirmed: renderers must not offer new moves. */
  busy: boolean;
  onAction: (action: GameAction) => void;
  /** Tutorial: the move the script expects next (highlight only; the server enforces it). */
  expected: GameAction | null;
}
