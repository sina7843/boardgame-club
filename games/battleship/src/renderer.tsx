// نبرد دریایی renderer: two vintage nautical charts. Each sea is a parchment-framed chart with sepia coordinates over
// deep water; ships are drawn steel hulls with deck guns, hits burn, misses leave splash rings, sunk hulls darken
// and list. Placement uses a fleet tray (pick a ship, rotate, tap a cell) with a local random layout to start from.
import './renderer.css';
import { useEffect, useMemo, useState } from 'react';
import bdOcean from './art/bd-ocean.webp';
import fxHit from './art/fx-hit.webp';
import fxMiss from './art/fx-miss.webp';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { FLEET, SIZE, cellsOf, validFleet, type BsView, type Dir, type SeaView, type Ship } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const ROWS = ['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د'];
const cellName = (c: number) => `${ROWS[Math.floor(c / SIZE)]}${fa((c % SIZE) + 1)}`;

/** Painted shot marker centred on (x, y): fire burst for a hit, white splash for a miss. */
export function Shot({ x, y, hit }: { x: number; y: number; hit: boolean }) {
  return hit
    ? <image href={fxHit} x={x - 5} y={y - 5} width="10" height="10" className="bs-fx bs-fx--hit" />
    : <image href={fxMiss} x={x - 4.5} y={y - 2.1} width="9" height="4.2" className="bs-fx bs-fx--miss" />;
}

/** A ship hull spanning its cells (10 units per cell), drawn horizontally and rotated when vertical. */
export function Hull({ s, sunk }: { s: Ship; sunk?: boolean }) {
  const L = FLEET[s.ship]!.len * 10;
  const guns = Math.max(1, FLEET[s.ship]!.len - 2);
  const body = `M1.6 1.1 H${L - 7} L${L - 0.8} 4.5 L${L - 7} 7.9 H1.6 Q0.3 4.5 1.6 1.1 Z`;
  return (
    <g className={`bs-hull ${sunk ? 'is-sunk' : ''}`} transform={`translate(${s.x * 10 + 0.5} ${s.y * 10 + 0.5}) ${s.dir === 'v' ? 'rotate(90 4.5 4.5)' : ''}`}>
      <path d={body} className="bs-hull__body" />
      <path d={`M3.5 4.5 H${L - 8}`} className="bs-hull__deck" />
      {Array.from({ length: guns }, (_, i) => {
        const cx = 6 + (i * (L - 16)) / Math.max(1, guns - 1 || 1);
        return <g key={i}><circle cx={cx} cy={4.5} r={1.75} className="bs-hull__gun" /><path d={`M${cx} 4.5 H${cx + 3}`} className="bs-hull__barrel" /></g>;
      })}
      {s.ship === 0 && <rect x={L * 0.55} y={2.6} width={4} height={3.8} rx={0.6} className="bs-hull__tower" />}
    </g>
  );
}

function Chart({ sea, mine, label, onCell, canCell, hint, draft, ghost }: {
  sea: SeaView; mine: boolean; label: string; onCell?: (c: number) => void; canCell?: (c: number) => boolean; hint?: number | null;
  draft?: Ship[]; ghost?: { cells: number[]; ok: boolean } | null;
}) {
  const shots = new Map(sea.shots.map((x) => [x.cell, x.hit]));
  const ships = draft ?? sea.ships;
  return (
    <section className={`bs-chart ${mine ? 'bs-chart--mine' : 'bs-chart--enemy'}`} aria-label={label}>
      <header className="bs-chart__head"><b>{label}</b><small>{fa(sea.afloat ?? ships.length)} کشتی شناور</small></header>
      <div className="bs-chart__frame" dir="ltr">
        <span className="bs-corner" aria-hidden />
        {Array.from({ length: SIZE }, (_, i) => <span key={`c${i}`} className="bs-coord bs-coord--col" aria-hidden>{fa(i + 1)}</span>)}
        {Array.from({ length: SIZE }, (_, i) => <span key={`r${i}`} className="bs-coord bs-coord--row" style={{ gridRow: i + 2 }} aria-hidden>{ROWS[i]}</span>)}
        <div className="bs-sea" style={{ gridRow: '2 / span 10', gridColumn: '2 / span 10' }}>
          <svg viewBox="0 0 100 100" className="bs-sea__art" aria-hidden>
            <image href={bdOcean} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
            {Array.from({ length: SIZE - 1 }, (_, i) => <g key={i}><path d={`M${(i + 1) * 10} 0 V100`} className="bs-grid" /><path d={`M0 ${(i + 1) * 10} H100`} className="bs-grid" /></g>)}
            {ships.map((s) => <Hull key={s.ship} s={s} sunk={sea.sunk.includes(s.ship)} />)}
            {ghost && ghost.cells.map((c) => <rect key={c} x={(c % SIZE) * 10 + 0.8} y={Math.floor(c / SIZE) * 10 + 0.8} width="8.4" height="8.4" rx="1.5" className={`bs-ghost ${ghost.ok ? '' : 'is-bad'}`} />)}
            {[...shots].map(([c, hit]) => <Shot key={c} x={(c % SIZE) * 10 + 5} y={Math.floor(c / SIZE) * 10 + 5} hit={hit} />)}
          </svg>
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

export default function BattleshipRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<BsView>) {
  const me = mySeat ?? 0;
  const opp = 1 - me;
  const hint = expected as unknown as Hint;
  const placing = legalActions.some((a) => a.type === 'place');
  const firing = legalActions.some((a) => a.type === 'fire');
  const [draft, setDraft] = useState<Ship[]>([]);
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
  const status = view.outcome ? null
    : placing ? { tone: 'mine' as const, text: draft.length < FLEET.length ? `ناوگان را بچینید: ${FLEET[pick ?? 0]!.name}` : 'ناوگان آماده است؛ چیدمان را تأیید کنید' }
      : view.phase === 'place' ? { tone: 'wait' as const, text: 'منتظر چیدمان حریف…' }
        : firing ? { tone: 'mine' as const, text: 'به دریای حریف شلیک کنید' }
          : { tone: 'wait' as const, text: `${seatName(view.current)} نشانه می‌گیرد…` };

  return (
    <div className="bs" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {last && view.phase === 'fire' && (
        <p className={`bs-report ${last.sunk !== null ? 'is-sunk' : last.hit ? 'is-hit' : 'is-miss'}`} key={view.seq} role="status">
          <bdi>{who(last.seat)}</bdi> به {cellName(last.cell)} شلیک کرد: {last.sunk !== null ? `غرق شد — ${FLEET[last.sunk]!.name}!` : last.hit ? 'اصابت!' : 'آب'}
        </p>
      )}

      <div className="bs-seas">
        {view.phase === 'fire' || view.outcome ? (
          <Chart sea={view.seas[opp]!} mine={false} label={`دریای ${who(opp)}`} hint={hint?.type === 'fire' ? hint.cell ?? null : null}
            onCell={firing && !busy ? (c) => onAction({ type: 'fire', cell: c }) : undefined} canCell={(c) => !view.seas[opp]!.shots.some((x) => x.cell === c)} />
        ) : null}
        <div onMouseLeave={() => setHover(null)} onMouseOver={placing ? (e) => { const c = (e.target as HTMLElement).closest('.bs-cell'); if (c?.parentElement) setHover([...c.parentElement.children].indexOf(c)); } : undefined}>
          <Chart sea={placing ? { ...view.seas[me]!, afloat: draft.length } : view.seas[me]!} mine label={placing ? 'چیدمان ناوگان شما' : 'دریای شما'}
            draft={placing ? draft : undefined} ghost={ghost}
            onCell={placing && !busy ? placeAt : undefined} />
        </div>
      </div>

      {placing && (
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
              {FLEET.map((f, i) => <span key={f.key} className={view.seas[k]!.sunk.includes(i) ? 'is-sunk' : ''}>{f.name}</span>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
