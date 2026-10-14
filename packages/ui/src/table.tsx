// Table-level shared components: PlayerSeat, TurnIndicator, ActionBar, Token, Hand (game-agnostic, «انار» language).
import type { ReactNode } from 'react';
import { cn, fa } from './components.tsx';
import { Icon } from './icons.tsx';

export function TurnIndicator({ tone, children }: { tone: 'mine' | 'wait' | 'done' | 'pending'; children: ReactNode }) {
  const icon = tone === 'mine' ? 'play' : tone === 'done' ? 'star' : 'clock';
  return (
    <div role="status" aria-live="polite"
      className={cn('turn inline-flex min-h-11 items-center gap-2 rounded-control px-5 py-2 font-bold', `turn--${tone}`,
        tone === 'mine' ? 'bg-primary text-primary-foreground shadow-control animate-pop' : tone === 'done' ? 'bg-success/12 text-success' : tone === 'pending' ? 'bg-warning/12 text-warning' : 'bg-secondary text-secondary-foreground')}>
      <Icon name={icon} size={18} strokeWidth={2} />{children}
    </div>
  );
}

export function ActionBar({ children, label = 'اقدام‌ها' }: { children: ReactNode; label?: string }) {
  return <div className="actionbar flex flex-wrap items-center justify-center gap-2 rounded-surface border-line border-border bg-card p-3 shadow-surface" role="toolbar" aria-label={label}>{children}</div>;
}

export function Token({ value, selected, disabled, onSelect, label }: {
  value: number; selected?: boolean; disabled?: boolean; onSelect?: () => void; label?: string;
}) {
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect} aria-label={label ?? `ژتون ${fa(value)}`}
      className={cn('token size-14 cursor-pointer rounded-full border-2 text-xl font-extrabold shadow-control transition-all duration-(--motion) ease-motion active:[transform:var(--press)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-35',
        selected ? 'token--selected -translate-y-1 border-brand bg-brand text-brand-foreground' : 'border-brand/60 bg-card text-foreground hover:-translate-y-0.5')}>
      {fa(value)}
    </button>
  );
}

export function Hand({ label, children }: { label: string; children: ReactNode }) {
  return <div className="hand flex flex-wrap justify-center gap-2" role="group" aria-label={label}>{children}</div>;
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
  /**
   * The player's own move until the server confirms it: while it waits in the undo window and while it is sent.
   * Renderers preview it at once — the card already flies to the pile, the dice already tumble — and undo just clears
   * it, so everything animates back. Instant moves (rolls, draws, end turn, pass, races) skip the window but are still
   * `queued` while in flight. Only what the client already knows may be shown: random outcomes (dice values, drawn
   * cards) arrive with the server result, so nobody can see a result and then undo. Include `!!queued` in the useFlip key.
   */
  queued?: GameAction | null;
  /** The player's own move after the undo window: sent, waiting for the server (e.g. keep dice tumbling until the result). */
  sending?: GameAction | null;
}
