// کاشی‌کار renderer: Isfahan tile-work. Factories are round kiln plates, the centre a brass tray; each player's
// board has a stepped set of pattern lines, the 5×5 wall with faint glazes for empty spots, and the floor with its
// penalties. Tap a tile group, then the line (or floor) to put it on.
import './renderer.css';
import { useEffect, useState, type ReactNode } from 'react';
import { TurnIndicator, type GameRendererProps } from '@bg/ui';
import { FLOOR, wallColor, type AzulView, type Color } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const COLOR_FA: Record<Color, string> = { b: 'لاجوردی', y: 'زعفرانی', r: 'اناری', k: 'مشکی', w: 'فیروزه‌ای' };

/* One illustrated motif per glaze so colour is never the only signal: lapis star, saffron sun, pomegranate flower,
   black lozenges, turquoise mihrab arch. */
const MOTIF: Record<Color, ReactNode> = {
  b: <><path d="M-5 -5H5V5H-5Z M0 -7.2L7.2 0L0 7.2L-7.2 0Z" className="az-m az-m--fill" /><circle r="2.2" className="az-m az-m--dark" /><circle r="0.8" className="az-m az-m--fill" /></>,
  y: <><circle r="3.1" className="az-m az-m--fill" /><circle r="1.4" className="az-m az-m--dark" /><path d="M0 -7.2V-4.8M0 4.8V7.2M-7.2 0H-4.8M4.8 0H7.2M-5.1 -5.1L-3.5 -3.5M5.1 -5.1L3.5 -3.5M-5.1 5.1L-3.5 3.5M5.1 5.1L3.5 3.5" className="az-m az-m--line" /></>,
  r: <><circle cx="0" cy="-3.1" r="3" className="az-m az-m--fill" /><circle cx="0" cy="3.1" r="3" className="az-m az-m--fill" /><circle cx="-3.1" cy="0" r="3" className="az-m az-m--fill" /><circle cx="3.1" cy="0" r="3" className="az-m az-m--fill" /><circle r="1.7" className="az-m az-m--dark" /></>,
  k: <><path d="M0 -7.4L7.4 0L0 7.4L-7.4 0Z" className="az-m az-m--line" /><path d="M0 -4.4L4.4 0L0 4.4L-4.4 0Z" className="az-m az-m--fill" /><path d="M0 -1.7L1.7 0L0 1.7L-1.7 0Z" className="az-m az-m--dark" /></>,
  w: <><path d="M-5 7.3V-1Q-5 -6.5 0 -7.6Q5 -6.5 5 -1V7.3Z" className="az-m az-m--line" /><path d="M-2.3 5.3V-0.6Q-2.3 -3.6 0 -4.4Q2.3 -3.6 2.3 -0.6V5.3Z" className="az-m az-m--fill" /><circle cy="0.4" r="0.9" className="az-m az-m--dark" /></>,
};

export function Tile({ c, size = 'md', ghost, fresh }: { c: Color | 'first'; size?: 'sm' | 'md'; ghost?: boolean; fresh?: boolean }) {
  return (
    <span className={['az-tile', `az-tile--${size}`, `az-c--${c}`, ghost ? 'az-tile--ghost' : '', fresh ? 'az-tile--fresh' : ''].join(' ')} aria-hidden="true">
      {c === 'first' ? (
        <svg viewBox="-10 -10 20 20"><path d="M0 -7.5L2 -2.2L7.5 -2.2L3.2 1.2L4.8 6.8L0 3.5L-4.8 6.8L-3.2 1.2L-7.5 -2.2L-2 -2.2Z" className="az-m az-m--fill" /><text y="2.6" textAnchor="middle" className="az-first">۱</text></svg>
      ) : (
        <svg viewBox="-10 -10 20 20"><rect x="-8.2" y="-8.2" width="16.4" height="16.4" rx="1.6" className="az-frame" />{MOTIF[c]}</svg>
      )}
    </span>
  );
}

type Pick = { from: number | 'center'; color: Color };

export default function AzulRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<AzulView>) {
  const takes = legalActions.filter((a) => a.type === 'take') as unknown as (Pick & { lines: number[] })[];
  const [pick, setPick] = useState<Pick | null>(null);
  useEffect(() => { setPick(null); }, [view.seq]);
  const hint = expected as unknown as (Pick & { type: string; line: number | 'floor' }) | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = takes.length > 0;
  const chosen = pick ? takes.find((t) => t.from === pick.from && t.color === pick.color) : undefined;
  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: chosen ? 'ردیف یا کف را انتخاب کنید' : 'یک دسته کاشی هم‌رنگ انتخاب کنید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const isPicked = (from: number | 'center', c: Color) => pick?.from === from && pick.color === c;
  const isHint = (from: number | 'center', c: Color) => !pick && hint?.type === 'take' && hint.from === from && hint.color === c;
  const tap = (from: number | 'center', c: Color) => { if (!myTurn || busy) return; setPick(isPicked(from, c) ? null : { from, color: c }); };
  const send = (line: number | 'floor') => { if (pick && !busy) onAction({ type: 'take', from: pick.from, color: pick.color, line }); };
  const order = mySeat === null ? view.boards.map((_, k) => k) : [mySeat, ...view.boards.map((_, k) => k).filter((k) => k !== mySeat)];
  const roundGains = view.last && 'kind' in view.last ? view.last.gains : null;
  const lastTake = view.last && !('kind' in view.last) ? view.last : null;

  const group = (from: number | 'center', tiles: Color[]) => {
    const byColor = [...new Set(tiles)];
    return byColor.map((c) => {
      const n = tiles.filter((t) => t === c).length;
      return (
        <button key={c} type="button" disabled={!myTurn || busy} onClick={() => tap(from, c)} aria-pressed={isPicked(from, c)}
          className={['az-grp', isPicked(from, c) ? 'az-grp--on' : '', isHint(from, c) ? 'az-hint' : ''].join(' ')} aria-label={`${fa(n)} کاشی ${COLOR_FA[c]}`}>
          {Array.from({ length: n }, (_, i) => <Tile key={i} c={c} />)}
        </button>
      );
    });
  };

  return (
    <div className="az" data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!view.outcome && <p className="az__round">دور {fa(view.round)}، کیسه: {fa(view.bagCount)} کاشی</p>}

      {!view.outcome && (
        <section className="az__market" aria-label="کارگاه‌ها">
          {view.factories.map((f, i) => (
            <div key={i} className={`az-factory ${f.length ? '' : 'az-factory--empty'}`} role="group" aria-label={`کارگاه ${fa(i + 1)}`}>
              {f.map((c, k) => (
                <button key={k} type="button" disabled={!myTurn || busy} onClick={() => tap(i, c)} aria-pressed={isPicked(i, c)}
                  className={['az-grp', 'az-ftile', isPicked(i, c) ? 'az-grp--on' : '', isHint(i, c) && f.indexOf(c) === k ? 'az-hint' : ''].join(' ')}
                  aria-label={`${fa(f.filter((x) => x === c).length)} کاشی ${COLOR_FA[c]}`}><Tile c={c} /></button>
              ))}
            </div>
          ))}
          <div className="az-center" aria-label="وسط میز">
            {view.firstInCenter && <Tile c="first" />}
            {group('center', view.center)}
            {!view.center.length && !view.firstInCenter && <span className="az-center__empty">وسط خالی</span>}
          </div>
        </section>
      )}

      {roundGains && !view.outcome && (
        <p className="az__gains" role="status" key={view.seq}>پایان دور: {roundGains.map((g, k) => <span key={k}><bdi>{who(k)}</bdi> {g.length ? g.map((x) => (x > 0 ? `+${fa(x)}` : `−${fa(-x)}`)).join(' ') : '۰'}</span>)}</p>
      )}

      <ul className="az__boards" aria-label="تخته‌ها">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const b = view.boards[s]!;
          const mine = s === mySeat && !!chosen;
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          return (
            <li key={s} className={['az-board', s === mySeat ? 'az-board--me' : '', view.current === s && !view.outcome ? 'az-board--turn' : '', place === 1 ? 'az-board--win' : ''].join(' ')}>
              <div className="az-board__head">
                {place && <b className="az-board__place">{fa(place)}</b>}
                <bdi className="az-board__name">{who(s)}</bdi>
                <span className="az-board__score" key={b.score}>{fa(b.score)}</span>
              </div>
              <div className="az-board__body">
                <div className="az-lines">
                  {b.lines.map((l, r) => {
                    const ok = mine && chosen!.lines.includes(r);
                    const cells = Array.from({ length: r + 1 }, (_, k) => (k < l.n ? <Tile key={k} c={l.color!} size="sm" fresh={lastTake?.seat === s && lastTake.line === r} /> : <span key={k} className="az-cell" />));
                    return ok
                      ? <button key={r} type="button" className={`az-line az-line--ok ${hint?.line === r ? 'az-hint' : ''}`} onClick={() => send(r)} aria-label={`ردیف ${fa(r + 1)}`}>{cells}</button>
                      : <div key={r} className="az-line">{cells}</div>;
                  })}
                </div>
                <div className="az-wall" aria-label="دیوار">
                  {b.wall.map((row, r) => row.map((on, c) => <Tile key={`${r}-${c}`} c={wallColor(r, c)} size="sm" ghost={!on} />))}
                </div>
              </div>
              {mine
                ? <button type="button" className={`az-floor az-floor--ok ${hint?.line === 'floor' ? 'az-hint' : ''}`} onClick={() => send('floor')} aria-label="کف">{floorCells(b.floor)}</button>
                : <div className="az-floor">{floorCells(b.floor)}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function floorCells(floor: (Color | 'first')[]) {
  return FLOOR.map((pen, i) => (
    <span key={i} className="az-floor__slot"><small>{fa(pen).replace('-', '−')}</small>{floor[i] ? <Tile c={floor[i]!} size="sm" /> : <span className="az-cell" />}</span>
  ));
}

