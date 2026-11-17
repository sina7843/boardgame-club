// نبرد دریایی renderer: two vintage nautical charts. Each sea is a parchment-framed chart with sepia coordinates over
// deep water; ships are drawn steel hulls with deck guns, hits burn, misses leave splash rings, sunk hulls darken
// and list. Placement uses a fleet tray (pick a ship, rotate, tap a cell) with a local random layout to start from.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import chart from './art/chart.png';
import fxHit from './art/fx-hit.png';
import fxMiss from './art/fx-miss.png';
import ship0 from './art/ship-0.png';
import ship1 from './art/ship-1.png';
import ship2 from './art/ship-2.png';
import ship3 from './art/ship-3.png';
import ship4 from './art/ship-4.png';
import ship0s from './art/ship-0-sunk.png';
import ship1s from './art/ship-1-sunk.png';
import ship2s from './art/ship-2-sunk.png';
import ship3s from './art/ship-3-sunk.png';
import ship4s from './art/ship-4-sunk.png';

const SHIPS = [ship0, ship1, ship2, ship3, ship4];
const SHIPS_SUNK = [ship0s, ship1s, ship2s, ship3s, ship4s];
const SHIP_PX = [272, 222, 172, 172, 122]; // art widths; 72px tall; ~54px per cell
import { Button, RailSlot, TurnIndicator, useFlip, useInFrame, type GameRendererProps } from '@bg/ui';
import { FLEET, SIZE, cellsOf, validFleet, type BsView, type Dir, type SeaView, type Ship } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const ROWS = ['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د'];
const cellName = (c: number) => `${ROWS[Math.floor(c / SIZE)]}${fa((c % SIZE) + 1)}`;

/** Painted shot marker centred on (x, y): fire burst for a hit, white splash for a miss. */
export function Shot({ x, y, hit, fresh, late, flip }: { x: number; y: number; hit: boolean; fresh?: boolean; late?: boolean; flip?: string }) {
  return (
    <g className={fresh ? 'bg-land' : undefined} data-flip={flip} data-flip-enter="none" style={fresh && late ? { ['--i' as string]: 10 } : undefined}>
      {hit
        ? <image href={fxHit} x={x - 5.5} y={y - 5.5} width="11" height="11" className="bs-fx bs-fx--hit" />
        : <image href={fxMiss} x={x - 4.5} y={y - 4.5} width="9" height="9" className="bs-fx bs-fx--miss" />}
    </g>
  );
}

/** A ship (art image) spanning its cells (10 units per cell), rotated about its centre when vertical. */
export function Hull({ s, sunk }: { s: Ship; sunk?: boolean }) {
  const len = FLEET[s.ship]!.len, k = 10 / 54.4, w = SHIP_PX[s.ship]! * k, h = 72 * k;
  const cx = s.x * 10 + (s.dir === 'h' ? len * 5 : 5), cy = s.y * 10 + (s.dir === 'v' ? len * 5 : 5);
  return (
    <g className={`bs-hull ${sunk ? 'is-sunk' : ''}`} transform={s.dir === 'v' ? `rotate(90 ${cx} ${cy})` : undefined}>
      <image href={(sunk ? SHIPS_SUNK : SHIPS)[s.ship]} x={cx - w / 2} y={cy - h / 2} width={w} height={h} />
    </g>
  );
}

function Chart({ sea, seat, me, mine, label, onCell, canCell, hint, draft, ghost, lastShot, aim }: {
  sea: SeaView; seat: number; me: number; mine: boolean; lastShot?: BsView['last']; aim?: number | null; label: string; onCell?: (c: number) => void; canCell?: (c: number) => boolean; hint?: number | null;
  draft?: Ship[]; ghost?: { cells: number[]; ok: boolean } | null;
}) {
  const shots = new Map(sea.shots.map((x) => [x.cell, x.hit]));
  const ships = draft ?? sea.ships;
  // An incoming shell (the opponent's shot on my sea) flies from the shooter's chart and the result lands after it
  // (`late`). My own shell carries the shot's flip id, so the server's answer replaces it in place.
  const late = !!lastShot && lastShot.seat !== me;
  const at = (c: number) => ({ insetInlineStart: `${(c % SIZE) * 10}%`, insetBlockStart: `${Math.floor(c / SIZE) * 10}%` });
  return (
    <section className={`bs-chart ${mine ? 'bs-chart--mine' : 'bs-chart--enemy'}`} aria-label={label}>
      <header className="bs-chart__head"><b>{label}</b><small>{fa(sea.afloat ?? ships.length)} کشتی شناور</small></header>
      <div className="bs-chart__frame" dir="ltr" style={{ backgroundImage: `url(${chart})` }} data-flip-anchor={`fleet-${seat}`}>
        <div className={`bs-sea ${lastShot?.hit ? `is-hit-${lastShot.cell % 2}` : ''} ${late ? 'is-late' : ''}`}>
          <svg viewBox="0 0 100 100" className="bs-sea__art" aria-hidden>
            {Array.from({ length: SIZE - 1 }, (_, i) => <g key={i}><path d={`M${(i + 1) * 10} 0 V100`} className="bs-grid" /><path d={`M0 ${(i + 1) * 10} H100`} className="bs-grid" /></g>)}
            {ships.map((s) => (
              <g key={s.ship} data-flip={mine ? `ship-${s.ship}` : undefined} className={lastShot?.sunk === s.ship ? (mine ? 'bg-pop' : 'bg-flip-in') : undefined}
                style={lastShot?.sunk === s.ship && late ? { ['--i' as string]: 8 } : undefined}>
                <Hull s={s} sunk={sea.sunk.includes(s.ship)} />
              </g>
            ))}
            {ghost && ghost.cells.map((c) => <rect key={c} x={(c % SIZE) * 10 + 0.8} y={Math.floor(c / SIZE) * 10 + 0.8} width="8.4" height="8.4" rx="1.5" className={`bs-ghost ${ghost.ok ? '' : 'is-bad'}`} />)}
            {[...shots].map(([c, hit]) => <Shot key={c} x={(c % SIZE) * 10 + 5} y={Math.floor(c / SIZE) * 10 + 5} hit={hit} fresh={lastShot?.cell === c} late={late}
              flip={`shot-${seat}-${c}`} />)}
          </svg>
          {aim != null && <span key={`a${aim}`} className="bs-shell" style={at(aim)} data-flip={`shot-${seat}-${aim}`} data-flip-from={`fleet-${me}`} data-flip-exit={`fleet-${me}`} aria-hidden />}
          {late && <span key={`i${lastShot.cell}`} className="bs-shell is-spent" style={at(lastShot.cell)} data-flip={`in-${seat}-${lastShot.cell}`} data-flip-from={`fleet-${lastShot.seat}`} aria-hidden />}
          <div className="bs-cells">
            {Array.from({ length: SIZE * SIZE }, (_, c) => {
              const can = !!onCell && (canCell ? canCell(c) : true);
              return can
                ? <button key={c} type="button" className={`bs-cell ${hint === c ? 'bs-hint' : ''}`} aria-label={`${mine ? 'گذاشتن در' : 'شلیک به'} ${cellName(c)}`} onClick={() => onCell!(c)} />
                : <span key={c} className="bs-cell" aria-hidden />;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function localRandomFleet(): Ship[] {
  for (;;) {
    const used = new Set<number>(); const ships: Ship[] = []; let ok = true;
    for (let i = 0; i < FLEET.length && ok; i++) {
      ok = false;
      for (let t = 0; t < 200 && !ok; t++) {
        const s: Ship = { ship: i, x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE), dir: Math.random() < 0.5 ? 'h' : 'v' };
        const cells = cellsOf(s);
        if (cells && !cells.some((c) => used.has(c))) { cells.forEach((c) => used.add(c)); ships.push(s); ok = true; }
      }
    }
    if (ok) return ships;
  }
}

type Hint = { type: string; cell?: number } | null;

export default function BattleshipRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued, sending }: GameRendererProps<BsView>) {
  const me = mySeat ?? 0;
  const opp = 1 - me;
  const framed = useInFrame() !== null;
  const hint = expected as unknown as Hint;
  const placing = legalActions.some((a) => a.type === 'place');
  const firing = legalActions.some((a) => a.type === 'fire');
  const [draft, setDraft] = useState<Ship[]>([]);
  const root = useRef<HTMLDivElement>(null);
  // Own move preview: the chosen shot is a shell over the target cell (no hit/miss until the server answers); a
  // confirmed fleet hides the tray. Undo clears `queued` and the shell flies back.
  const own = queued ?? sending ?? null;
  const aim = own?.type === 'fire' ? (own.cell as number) : null;
  const fleetDone = own?.type === 'place' || own?.type === 'placeRandom';
  useFlip(root, `${view.seq}:${aim ?? ''}:${fleetDone}:${draft.map((s) => `${s.ship}${s.x}${s.y}${s.dir}`).join()}`);
  const [pick, setPick] = useState<number | null>(0);
  const [dir, setDir] = useState<Dir>('h');
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { if (!placing) { setDraft([]); setHover(null); } }, [placing]);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const occupied = useMemo(() => new Set(draft.filter((s) => s.ship !== pick).flatMap((s) => cellsOf(s) ?? [])), [draft, pick]);
  const trial = (c: number): Ship | null => (pick === null ? null : { ship: pick, x: c % SIZE, y: Math.floor(c / SIZE), dir });
  const fits = (s: Ship | null) => { const cells = s && cellsOf(s); return !!cells && !cells.some((x) => occupied.has(x)); };
  const placeAt = (c: number) => {
    const at = draft.find((s) => cellsOf(s)!.includes(c));
    if (at && pick === null) { setPick(at.ship); setDraft(draft.filter((s) => s !== at)); return; }
    const s = trial(c);
    if (!s || !fits(s)) return;
    const next = [...draft.filter((x) => x.ship !== s.ship), s];
    setDraft(next);
    const left = FLEET.map((_, i) => i).find((i) => !next.some((x) => x.ship === i));
    setPick(left ?? null);
  };
  const ghostShip = hover !== null ? trial(hover) : null;
  const ghost = placing && ghostShip ? { cells: (cellsOf(ghostShip) ?? []).filter((c) => c < SIZE * SIZE), ok: fits(ghostShip) } : null;
  const last = view.last;
  const shotOn = (k: number) => (last && last.seat !== k ? last : null);
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : placing && fleetDone ? { tone: 'wait' as const, text: 'منتظر چیدمان حریف…' }
    : placing ? { tone: 'mine' as const, text: draft.length < FLEET.length ? `ناوگان را بچینید: ${FLEET[pick ?? 0]!.name}` : 'ناوگان آماده است؛ چیدمان را تأیید کنید' }
      : view.phase === 'place' ? { tone: 'wait' as const, text: 'منتظر چیدمان حریف…' }
        : firing ? { tone: 'mine' as const, text: 'به دریای حریف شلیک کنید' }
          : { tone: 'wait' as const, text: `${seatName(view.current)} نشانه می‌گیرد…` };

  return (
    <div className="bs" data-seq={view.seq} data-phase={view.phase} ref={root}>
      {framed && (
        <RailSlot>
          <p><b>{placing ? 'هر ناو افقی یا عمودی؛ ناوها می‌توانند کنار هم باشند ولی روی هم نه.' : 'هر نوبت یک شلیک؛ اصابت یعنی دوباره حدس بزنید همان اطراف.'}</b></p>
          <p>ناو هواپیمابر ۵ خانه، رزمناو ۴، ناوشکن و زیردریایی ۳ و قایق گشتی ۲ خانه است. وقتی همهٔ خانه‌های یک ناو بخورد غرق می‌شود.</p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {last && view.phase === 'fire' && (
        <p className={`bs-report ${last.sunk !== null ? 'is-sunk' : last.hit ? 'is-hit' : 'is-miss'}`} key={view.seq} role="status">
          <bdi>{who(last.seat)}</bdi> به {cellName(last.cell)} شلیک کرد: {last.sunk !== null ? `غرق شد — ${FLEET[last.sunk]!.name}!` : last.hit ? 'اصابت!' : 'آب'}
        </p>
      )}
      {!last && view.phase === 'fire' && <p className="bs-report" style={{ visibility: 'hidden' }} aria-hidden>&nbsp;</p>}

      <div className="bs-seas">
        {view.phase === 'fire' || view.outcome ? (
          <Chart sea={view.seas[opp]!} seat={opp} me={me} aim={aim} mine={false} lastShot={shotOn(opp)} label={`دریای ${who(opp)}`} hint={hint?.type === 'fire' ? hint.cell ?? null : null}
            onCell={firing && !busy ? (c) => onAction({ type: 'fire', cell: c }) : undefined} canCell={(c) => !view.seas[opp]!.shots.some((x) => x.cell === c)} />
        ) : null}
        <div onMouseLeave={() => setHover(null)} onMouseOver={placing ? (e) => { const c = (e.target as HTMLElement).closest('.bs-cell'); if (c?.parentElement) setHover([...c.parentElement.children].indexOf(c)); } : undefined}>
          <Chart sea={placing ? { ...view.seas[me]!, afloat: draft.length } : view.seas[me]!} seat={me} me={me} mine lastShot={shotOn(me)} label={placing ? 'چیدمان ناوگان شما' : 'دریای شما'}
            draft={placing ? draft : undefined} ghost={ghost}
            onCell={placing && !busy ? placeAt : undefined} />
        </div>
      </div>

      {placing && !fleetDone && (
        <section className="bs-tray" aria-label="ناوگان">
          <div className="bs-tray__ships">
            {FLEET.map((f, i) => {
              const placed = draft.some((s) => s.ship === i);
              return (
                <button key={f.key} type="button" aria-pressed={pick === i} disabled={busy}
                  className={['bs-tray__ship', pick === i ? 'is-on' : '', placed ? 'is-placed' : ''].join(' ')}
                  onClick={() => { setPick(i); setDraft(draft.filter((s) => s.ship !== i)); }}>
                  <span className="bs-tray__len">{Array.from({ length: f.len }, (_, k) => <i key={k} />)}</span>
                  <small>{f.name}{placed ? ' ✓' : ''}</small>
                </button>
              );
            })}
          </div>
          <div className="bs-tray__bar">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDir(dir === 'h' ? 'v' : 'h')}>چرخاندن ({dir === 'h' ? 'افقی' : 'عمودی'})</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setDraft(localRandomFleet()); setPick(null); }}>چیدمان تصادفی</Button>
            <Button size="sm" disabled={busy || !validFleet(draft)} onClick={() => onAction({ type: 'place', ships: draft })}>تأیید چیدمان</Button>
          </div>
        </section>
      )}

      {view.phase === 'fire' && (
        <ul className="bs-fleets" aria-label="وضعیت ناوگان‌ها">
          {[opp, me].map((k) => (
            <li key={k}>
              <b><bdi>{who(k)}</bdi></b>
              {FLEET.map((f, i) => <span key={f.key} className={view.seas[k]!.sunk.includes(i) ? `is-sunk ${last?.sunk === i && last.seat !== k ? 'bg-hit' : ''}` : ''}>{f.name}</span>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
