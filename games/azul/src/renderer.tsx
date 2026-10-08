// Tile art is cut from a generated sheet (see DECISIONS.md).
// کاشی‌کار renderer: Isfahan tile-work. Factories are round kiln plates, the centre a brass tray; each player's
// board has a stepped set of pattern lines, the 5×5 wall with faint glazes for empty spots, and the floor with its
// penalties. Tap a tile group, then the line (or floor) to put it on.
import './renderer.css';
import { useEffect, useState } from 'react';
import { TurnIndicator, type GameRendererProps } from '@bg/ui';
import tileBlue from './art/tile-blue.webp';
import tileYellow from './art/tile-yellow.webp';
import tileRed from './art/tile-red.webp';
import tileBlack from './art/tile-black.webp';
import tileTeal from './art/tile-teal.webp';
import tileFirst from './art/tile-first.webp';
import { FLOOR, wallColor, type AzulView, type Color } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const COLOR_FA: Record<Color, string> = { b: 'لاجوردی', y: 'زعفرانی', r: 'اناری', k: 'مشکی', w: 'فیروزه‌ای' };

/* Painted glaze per colour, cut from a generated sprite sheet (see DECISIONS.md). */
const TILE_ART: Record<Color | 'first', string> = { b: tileBlue, y: tileYellow, r: tileRed, k: tileBlack, w: tileTeal, first: tileFirst };

export function Tile({ c, size = 'md', ghost, fresh }: { c: Color | 'first'; size?: 'sm' | 'md'; ghost?: boolean; fresh?: boolean }) {
  return (
    <span className={['az-tile', `az-tile--${size}`, ghost ? 'az-tile--ghost' : '', fresh ? 'az-tile--fresh' : ''].join(' ')} aria-hidden="true">
      <img src={TILE_ART[c]} alt="" draggable={false} />
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

