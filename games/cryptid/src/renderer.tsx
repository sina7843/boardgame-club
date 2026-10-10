// کریپتید renderer: a naturalist's field map. The 12×9 hex board (painted terrain, dashed animal territories, coloured
// stones and shacks, player discs and cubes) is spatial, so it is drawn dir="ltr" with numbered columns and rows. Your
// secret clue sits on a parchment card; the action panel picks «پرسیدن» (+ player) or «جست‌وجو», then a highlighted cell,
// then «ثبت». Only the projection is shown: other players' clues and the answer appear only after the game ends.
import './renderer.css';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button, TurnIndicator, ZoomBoard, useFlip, useFresh, type GameRendererProps } from '@bg/ui';
import artForest from './art/forest.webp';
import artDesert from './art/desert.webp';
import artSwamp from './art/swamp.webp';
import artMountain from './art/mountain.webp';
import artWater from './art/water.webp';
import artBear from './art/bear.webp';
import artCougar from './art/cougar.webp';
import artCryptid from './art/cryptid.webp';
import artStone from './art/stone.webp';
import artShack from './art/shack.webp';
import artParchment from './art/parchment.webp';
import { COLORS, COLS, ROWS, TERRAINS, type Clue, type CryptidView, type LogEntry, type SColor, type Target, type Terrain } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const TERRAIN_FA: Record<Terrain, string> = { forest: 'جنگل', desert: 'بیابان', swamp: 'مرداب', mountain: 'کوهستان', water: 'آب' };
const TERRAIN_ART: Record<Terrain, string> = { forest: artForest, desert: artDesert, swamp: artSwamp, mountain: artMountain, water: artWater };
const TERRAIN_FILL: Record<Terrain, string> = { forest: '#2f5d34', desert: '#d6a85a', swamp: '#5e6b3a', mountain: '#8d939a', water: '#2d5f8f' };
export const COLOR_FA: Record<SColor, string> = { white: 'سفید', green: 'سبز', blue: 'آبی', black: 'سیاه' };
const COLOR_HEX: Record<SColor, string> = { white: '#f4f1e8', green: '#2fa35a', blue: '#2f6fd6', black: '#1b1b1f' };
/** A small shape inside each structure so its colour is not told by hue alone: green ▲, blue ●, black ■, white plain. */
const colorMark = (c: SColor, x: number, y: number) => c === 'green' ? <path d={`M${x} ${y - 2.6} L${x + 2.6} ${y + 2} L${x - 2.6} ${y + 2} Z`} className="cr-mark" />
  : c === 'blue' ? <circle cx={x} cy={y} r="2.3" className="cr-mark" />
    : c === 'black' ? <rect x={x - 2} y={y - 2} width="4" height="4" className="cr-mark" /> : null;
const TARGET_FA: Record<string, string> = { ...TERRAIN_FA, animal: 'قلمرو یکی از جانوران', bear: 'قلمرو خرس', cougar: 'قلمرو پوما', stone: 'سنگ ایستاده', shack: 'کلبهٔ متروک' };
export const SEAT_COLOR = ['#d8433b', '#3a7be0', '#e9b52c', '#9b59c9', '#21a597'];
const SEAT_FA = ['قرمز', 'آبی', 'زرد', 'بنفش', 'فیروزه‌ای'];

export function clueFa(c: Clue): string {
  const n = c.not ? 'نه ' : '';
  if (c.d === 0) return `${n}روی ${TERRAIN_FA[c.a as Terrain]} یا ${TERRAIN_FA[c.b!]}`;
  const what = c.d === 3 ? `سازهٔ ${COLOR_FA[c.a as SColor]}` : TARGET_FA[c.a as Target]!;
  return `${n}در فاصلهٔ ${fa(c.d)} خانه از ${what}`;
}
export const cellFa = (i: number) => `ستون ${fa((i % COLS) + 1)}، ردیف ${fa(Math.floor(i / COLS) + 1)}`;

// Flat-top hexes, odd columns half a hex lower (same grid as rules.ts).
const R = 20, H = Math.sqrt(3) * R, PAD = 18;
const center = (i: number) => { const q = i % COLS, r = Math.floor(i / COLS); return { x: PAD + R + q * 1.5 * R, y: PAD + H / 2 + r * H + (q & 1 ? H / 2 : 0) }; };
const hexPts = (x: number, y: number, k = R) => Array.from({ length: 6 }, (_, j) => `${(x + k * Math.cos((Math.PI / 3) * j)).toFixed(1)},${(y + k * Math.sin((Math.PI / 3) * j)).toFixed(1)}`).join(' ');
const W = PAD + R * (1.5 * (COLS - 1) + 2) + 4, HT = PAD + H * (ROWS + 0.5) + 4;

function describe(e: LogEntry, who: (s: number) => string): string {
  switch (e.t) {
    case 'cube': return `${who(e.seat)} مکعب گذاشت روی ${cellFa(e.cell)}${e.opening ? ' (شروع بازی)' : ''}${e.auto ? ' — خودکار، پایان زمان' : ''}.`;
    case 'question': return `${who(e.seat)} از ${who(e.target)} دربارهٔ ${cellFa(e.cell)} پرسید: ${e.yes ? 'بله (دیسک)' : 'نه (مکعب)'}.`;
    case 'search': return `${who(e.seat)} ${cellFa(e.cell)} را جست‌وجو کرد: ${e.results.map((r) => `${who(r.seat)} ${r.yes ? 'تأیید' : 'رد'}`).join('، ') || '—'}${e.results.every((r) => r.yes) ? ' — جانور پیدا شد!' : '.'}`;
    case 'skip': return `زمان ${who(e.seat)} تمام شد و نوبتش رد شد.`;
    case 'out': return `${who(e.seat)} ${e.why === 'resign' ? 'انصراف داد' : 'به خاطر دو نوبت ازدست‌رفته حذف شد'}؛ سرنخش همچنان جواب می‌دهد.`;
  }
}

type Mode = 'ask' | 'search';

export default function CryptidRenderer({ view: served, legalActions: legal, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CryptidView>) {
  // Undo-window preview: my queued cube, or the disc my search puts down first, is on the map at once. A question's
  // answer and the other players' search replies come from their secret clues, so those wait for the server.
  const qCell = mySeat !== null && (queued?.type === 'placeCube' || queued?.type === 'search') ? (queued.cell as number) : null;
  const view: CryptidView = qCell === null ? served
    : queued!.type === 'placeCube' ? { ...served, cubes: served.cubes.map((c, i) => (i === qCell ? mySeat : c)) }
      : { ...served, discs: served.discs.map((d, i) => (i === qCell && !d.includes(mySeat!) ? [...d, mySeat!] : d)) };
  const legalActions = queued ? [] : legal;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${qCell ?? ''}`);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const asks = legalActions.filter((a) => a.type === 'question') as unknown as { target: number; cells: number[] }[];
  const search = legalActions.find((a) => a.type === 'search') as unknown as { cells: number[] } | undefined;
  const cube = legalActions.find((a) => a.type === 'placeCube') as unknown as { cells: number[] } | undefined;
  const hint = expected as unknown as { type: string; target?: number; cell?: number } | null;

  const [mode, setMode] = useState<Mode | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { setMode(null); setTarget(null); setSel(null); }, [view.seq]);
  const tgt = target ?? (asks.length === 1 ? asks[0]!.target : null);

  const targets = new Set<number>(cube ? cube.cells : mode === 'search' ? search?.cells ?? [] : mode === 'ask' && tgt !== null ? asks.find((a) => a.target === tgt)?.cells ?? [] : []);
  const action = cube && sel !== null ? { type: 'placeCube', cell: sel }
    : mode === 'search' && sel !== null ? { type: 'search', cell: sel }
      : mode === 'ask' && tgt !== null && sel !== null ? { type: 'question', target: tgt, cell: sel } : null;
  const same = (a: { type: string; target?: number; cell?: number } | null) => !!a && !!hint && a.type === hint.type && a.cell === hint.cell && a.target === hint.target;
  const hintCell = hint && (hint.type === 'placeCube' || (hint.type === 'search' && mode === 'search') || (hint.type === 'question' && mode === 'ask' && tgt === hint.target)) ? hint.cell : undefined;

  const pick = (i: number) => { if (targets.has(i) && !busy) setSel(sel === i ? null : i); };
  const key = (e: KeyboardEvent, i: number) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } };

  // Fresh discs/cubes pop in.
  const keys = [...view.discs.flatMap((d, i) => d.map((s) => `d${i}-${s}`)), ...view.cubes.flatMap((c, i) => (c === null ? [] : [`c${i}`]))];
  const fresh = useFresh(keys);

  const myTurn = !!(cube || search || asks.length);
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : cube ? { tone: 'mine' as const, text: view.phase === 'opening' ? 'یک مکعب روی خانه‌ای بگذارید که سرنختان رد می‌کند' : `${view.log.slice().reverse().find((e) => e.t === 'search' || e.t === 'question')?.t === 'search' ? 'جست‌وجو رد شد' : 'جواب منفی بود'}: یک مکعب روی خانه‌ای بگذارید که سرنختان رد می‌کند` }
      : myTurn ? { tone: 'mine' as const, text: 'نوبت شما: بپرسید یا جست‌وجو کنید' }
        : { tone: 'wait' as const, text: `نوبت ${who(view.current)}${view.phase === 'opening' ? ' (مکعب شروع)' : view.phase === 'penalty' ? ' (مکعب اجباری)' : ''}` };
  const winner = view.outcome?.placements.find((p) => p.place === 1)?.seat;

  return (
    <div className="cr" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {view.outcome && <TurnIndicator tone="done">{winner === mySeat ? 'شما جانور را پیدا کردید!' : `${who(winner!)} برنده شد`}</TurnIndicator>}

      {view.myClue && (
        <section className="cr-clue" aria-label="سرنخ مخفی شما" style={{ backgroundImage: `url(${artParchment})` }}>
          <span className="cr-clue__label">سرنخ مخفی شما</span>
          <b className="cr-clue__text">{clueFa(view.myClue)}</b>
        </section>
      )}

      {view.reveal && (
        <section className="cr-reveal" aria-label="سرنخ‌ها و جواب">
          <img src={artCryptid} alt="" className="cr-reveal__art" draggable={false} />
          <div>
            <p className="cr-reveal__ans">جانور در <b>{cellFa(view.reveal.answer)}</b> ({TERRAIN_FA[view.cells[view.reveal.answer]!.terrain]}) بود.</p>
            <ul>{view.reveal.clues.map((c, k) => <li key={k}><span className="cr-dot" style={{ background: SEAT_COLOR[k] }} /> <bdi>{who(k)}</bdi>: {clueFa(c)}</li>)}</ul>
          </div>
        </section>
      )}

      {(asks.length > 0 || search) && (
        <div className="cr-actions" role="group" aria-label="کار این نوبت">
          <div className="cr-modes">
            <button type="button" className={['cr-mode', mode === 'ask' ? 'cr-on' : '', hint?.type === 'question' && mode !== 'ask' ? 'cr-hint' : ''].join(' ')} aria-pressed={mode === 'ask'} disabled={busy} onClick={() => { setMode('ask'); setSel(null); }}>پرسیدن</button>
            <button type="button" className={['cr-mode', mode === 'search' ? 'cr-on' : '', hint?.type === 'search' && mode !== 'search' ? 'cr-hint' : ''].join(' ')} aria-pressed={mode === 'search'} disabled={busy || !search?.cells.length} onClick={() => { setMode('search'); setSel(null); }}>جست‌وجو</button>
          </div>
          {mode === 'ask' && (
            <div className="cr-targets" role="group" aria-label="از چه کسی می‌پرسید؟">
              {asks.map((a) => (
                <button key={a.target} type="button" className={['cr-target', tgt === a.target ? 'cr-on' : '', hint?.type === 'question' && hint.target === a.target && tgt !== a.target ? 'cr-hint' : ''].join(' ')}
                  aria-pressed={tgt === a.target} disabled={busy || !a.cells.length} onClick={() => { setTarget(a.target); setSel(null); }}>
                  <span className="cr-dot" style={{ background: SEAT_COLOR[a.target] }} /><bdi>{who(a.target)}</bdi>
                </button>
              ))}
            </div>
          )}
          {mode && <p className="cr-help">{mode === 'search' ? 'خانه‌ای را انتخاب کنید که سرنخ شما مجاز می‌داند؛ بقیه به ترتیب تأیید یا رد می‌کنند.' : tgt === null ? 'بازیکنی را انتخاب کنید.' : 'خانه‌ای بدون مکعب را انتخاب کنید؛ سرور از روی سرنخ او جواب می‌دهد.'}</p>}
        </div>
      )}

      {(action || (cube && sel === null)) && (
        <div className="cr-confirm-bar">
          <span>{action ? `${action.type === 'placeCube' ? 'مکعب روی' : action.type === 'search' ? 'جست‌وجوی' : `پرسش از ${who(tgt!)} دربارهٔ`} ${cellFa(sel!)}` : 'خانهٔ مکعب را روی نقشه انتخاب کنید.'}</span>
          {action && <Button size="sm" disabled={busy} className={['cr-confirm', same(action) ? 'cr-hint' : ''].join(' ')} onClick={() => onAction(action)}>ثبت</Button>}
        </div>
      )}

      <div dir="ltr" className="cr-zoom"><ZoomBoard label="نقشهٔ کریپتید">
        <svg className="cr-board" viewBox={`0 0 ${W.toFixed(0)} ${HT.toFixed(0)}`} style={{ direction: 'ltr' }} role="group" aria-label="نقشهٔ کریپتید">
          <defs>
            {TERRAINS.map((t) => (
              <pattern key={t} id={`cr-t-${t}`} patternUnits="userSpaceOnUse" width="64" height="64">
                <rect width="64" height="64" fill={TERRAIN_FILL[t]} />
                <image href={TERRAIN_ART[t]} width="64" height="64" preserveAspectRatio="xMidYMid slice" />
              </pattern>
            ))}
          </defs>
          {Array.from({ length: COLS }, (_, q) => <text key={`q${q}`} className="cr-coord" x={PAD + R + q * 1.5 * R} y={11} textAnchor="middle">{fa(q + 1)}</text>)}
          {Array.from({ length: ROWS }, (_, r) => <text key={`r${r}`} className="cr-coord" x={7} y={PAD + H / 2 + r * H + 4} textAnchor="middle">{fa(r + 1)}</text>)}
          {view.cells.map((c, i) => {
            const { x, y } = center(i);
            const can = targets.has(i) && !busy;
            const label = `${cellFa(i)}: ${TERRAIN_FA[c.terrain]}${c.animal ? `، قلمرو ${c.animal === 'bear' ? 'خرس' : 'پوما'}` : ''}${c.structure ? `، ${c.structure.kind === 'stone' ? 'سنگ ایستادهٔ' : 'کلبهٔ'} ${COLOR_FA[c.structure.color]}` : ''}${view.cubes[i] !== null ? `، مکعب ${who(view.cubes[i]!)}` : ''}${view.discs[i]!.length ? `، دیسک ${view.discs[i]!.map(who).join('، ')}` : ''}`;
            return (
              <g key={i} className={['cr-cell', can ? 'cr-target-cell' : '', sel === i ? 'cr-sel' : '', hintCell === i && sel !== i ? 'cr-hint' : '', view.reveal?.answer === i ? 'cr-answer' : ''].join(' ')}
                role={can ? 'button' : 'img'} tabIndex={can ? 0 : undefined} aria-label={label} aria-pressed={can ? sel === i : undefined}
                onClick={() => pick(i)} onKeyDown={(e) => key(e, i)}>
                <title>{label}</title>
                <polygon points={hexPts(x, y)} fill={`url(#cr-t-${c.terrain})`} className="cr-hex" />
                {view.reveal?.answer === i && <image href={artCryptid} x={x - 14} y={y - 14} width="28" height="28" className="cr-pop" />}
                {c.animal && <polygon points={hexPts(x, y, R - 3)} className={`cr-animal cr-animal--${c.animal}`} />}
                {c.animal && <image href={c.animal === 'bear' ? artBear : artCougar} x={x - 6} y={y - R + 3} width="12" height="12" />}
                {c.structure && (c.structure.kind === 'stone'
                  ? <path d={`M${x - 4} ${y + 7} L${x - 5} ${y - 5} Q${x} ${y - 11} ${x + 5} ${y - 5} L${x + 4} ${y + 7} Z`} fill={COLOR_HEX[c.structure.color]} className="cr-struct" />
                  : <path d={`M${x - 7} ${y + 6} L${x - 7} ${y - 1} L${x} ${y - 8} L${x + 7} ${y - 1} L${x + 7} ${y + 6} Z`} fill={COLOR_HEX[c.structure.color]} className="cr-struct" />)}
                {c.structure && colorMark(c.structure.color, x, y + 2)}
                {view.discs[i]!.map((s, k) => {
                  const dx = x + (k - (view.discs[i]!.length - 1) / 2) * 7.5;
                  return (
                    <g key={`d${s}`} className={fresh.has(`d${i}-${s}`) ? 'cr-pop' : undefined}>
                      <circle cx={dx} cy={y + 11} r="3.8" fill={SEAT_COLOR[s]} className="cr-disc" />
                      <text x={dx} y={y + 12.8} className="cr-seatno" textAnchor="middle">{fa(s + 1)}</text>
                    </g>
                  );
                })}
                {view.cubes[i] !== null && (() => {
                  // A cube sits beside a structure (never on top of it) so the structure stays readable.
                  const [cx, cy, sz] = c.structure ? [x + 12.5, y - 1, 9] : [x, y, 12];
                  return (
                    <g className={fresh.has(`c${i}`) ? 'cr-pop' : undefined}>
                      <rect x={cx - sz / 2} y={cy - sz / 2} width={sz} height={sz} rx="1.5" fill={SEAT_COLOR[view.cubes[i]!]} className="cr-cube" />
                      <text x={cx} y={cy + sz * 0.26} className="cr-seatno" style={{ fontSize: sz * 0.7 }} textAnchor="middle">{fa(view.cubes[i]! + 1)}</text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>
      </ZoomBoard></div>

      <ul className="cr-legend" aria-label="راهنمای نقشه">
        {TERRAINS.map((t) => <li key={t}><img src={TERRAIN_ART[t]} alt="" className="cr-swatch" />{TERRAIN_FA[t]}</li>)}
        <li><img src={artBear} alt="" className="cr-swatch cr-swatch--icon" />قلمرو خرس (خط‌چین قهوه‌ای)</li>
        <li><img src={artCougar} alt="" className="cr-swatch cr-swatch--icon" />قلمرو پوما (خط‌چین نارنجی)</li>
        <li><img src={artStone} alt="" className="cr-swatch cr-swatch--icon" />سنگ ایستاده (ستون رنگی)</li>
        <li><img src={artShack} alt="" className="cr-swatch cr-swatch--icon" />کلبهٔ متروک (خانهٔ رنگی)</li>
        {(view.advanced ? COLORS : COLORS.slice(0, 3)).map((c) => <li key={c}><svg className="cr-key cr-key--svg" viewBox="-6 -6 12 12" aria-hidden="true"><rect x="-6" y="-6" width="12" height="12" fill={COLOR_HEX[c]} />{colorMark(c, 0, 0)}</svg>سازهٔ {COLOR_FA[c]}</li>)}
        <li><span className="cr-key cr-key--disc" />دیسک = بله</li>
        <li><span className="cr-key cr-key--cube" />مکعب = نه</li>
      </ul>

      <ul className="cr-players" aria-label="بازیکنان">
        {Array.from({ length: view.players }, (_, s) => {
          const place = view.outcome?.placements.find((p) => p.seat === s)?.place;
          return (
            <li key={s} className={['cr-pl', view.current === s && !view.outcome ? 'cr-pl--turn' : '', s === mySeat ? 'cr-pl--me' : '', !view.active[s] ? 'cr-pl--out' : ''].join(' ')} aria-current={view.current === s && !view.outcome ? 'true' : undefined}>
              <span className="cr-dot" style={{ background: SEAT_COLOR[s] }} title={SEAT_FA[s]} />
              <bdi className="cr-pl__name">{who(s)}</bdi>
              <span className="cr-pl__meta">{SEAT_FA[s]} (شمارهٔ {fa(s + 1)}) · {fa(view.discs.filter((d) => d.includes(s)).length)} دیسک · {fa(view.cubes.filter((c) => c === s).length)} مکعب{!view.active[s] ? ' · بیرون' : ''}{place ? ` · رتبهٔ ${fa(place)}` : ''}</span>
            </li>
          );
        })}
      </ul>

      <section className="cr-log" aria-label="رویدادها">
        <ol>{view.log.slice().reverse().slice(0, 12).map((e, k) => <li key={view.log.length - k}>{describe(e, who)}</li>)}</ol>
      </section>
    </div>
  );
}
