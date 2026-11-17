// Chess table (design/games/chess, CX-1..CX-12). The renderer draws the board, player bars, clocks, rail and phone dock;
// the shell (apps/web Table.tsx) passes platform data through `frame` (names, ratings, live clocks, connection, result
// panel) and keeps the game bar and chat. Rules are never computed here: targets, en passant, castling, check and
// promotion come from `legalActions` and the view. Board coordinates stay literal (dir=ltr); text is Persian.
import './renderer.css';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useFlip, usePieceIds, type FrameClockState, type GameRendererProps, type TableFrame, type TableFrameSeat } from '@bg/ui';
import { Avatar, Button, Dialog, Icon, League, Sheet, Switch } from '@bg/ui/bgv';
import { PIECE_SETS, PIECE_SET_FA, pieceSrc, type PieceSet } from './pieces.tsx';
import type { ChessView, Color, Piece, PieceType, PromoType } from './rules.ts';

const FILES = 'abcdefgh';
const faNum = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false });
const NAME_FA: Record<PieceType, string> = { K: 'شاه', Q: 'وزیر', R: 'رخ', B: 'فیل', N: 'اسب', P: 'سرباز' };
const COLOR_FA: Record<Color, string> = { w: 'سفید', b: 'سیاه' };
const VALUE: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
const LEAGUE_FA: Record<string, string> = { bronze: 'برنز', silver: 'نقره', gold: 'طلا', platinum: 'پلاتین', diamond: 'الماس', master: 'استاد' };
const pieceLabel = (p: Piece) => `${NAME_FA[p[1] as PieceType]} ${COLOR_FA[p[0] as Color]}`;
const sqName = (i: number) => FILES[i % 8]! + String(Math.floor(i / 8) + 1);
const idx = (name: string) => (Number(name[1]) - 1) * 8 + FILES.indexOf(name[0]!);
type MoveHint = { type: 'move'; from: string; to: string; promotion?: PromoType };
type Premove = { from: string; to: string };

/** Board themes (data/board-tokens.json, Chess-Spec §9). The felt never changes with the theme. */
const THEMES = ['tournament-green', 'walnut', 'ink-navy', 'persian-kashi', 'marble', 'clay', 'neon-night'] as const;
type Theme = (typeof THEMES)[number];
const THEME_FA: Record<Theme, string> = {
  'tournament-green': 'سبز مسابقه‌ای', walnut: 'گردو', 'ink-navy': 'سرمه‌ای', 'persian-kashi': 'کاشی ایرانی', marble: 'مرمر', clay: 'خمیری', 'neon-night': 'نئون شب'
};

// ---------- settings (per device; Chess-Spec §9) ----------
interface Prefs { theme: Theme; set: PieceSet; coords: boolean; dots: boolean; last: boolean; premove: boolean; autoQueen: boolean }
const DEFAULT_PREFS: Prefs = { theme: 'tournament-green', set: 'classic', coords: true, dots: true, last: true, premove: true, autoQueen: false };
const PREFS_KEY = 'bg.chess';
function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>) }; } catch { return DEFAULT_PREFS; }
}
function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState(loadPrefs);
  const update = useCallback((p: Partial<Prefs>) => setPrefs((old) => {
    const next = { ...old, ...p };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* storage blocked: this visit only */ }
    return next;
  }), []);
  return [prefs, update];
}
function useNarrow(maxPx: number) {
  const q = `(max-width: ${maxPx}px)`;
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setOn(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, [q]);
  return on;
}

// ---------- board helpers (display only) ----------
const START: (Piece | null)[] = (() => {
  const b: (Piece | null)[] = Array(64).fill(null);
  const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  back.forEach((t, f) => { b[f] = `w${t}`; b[56 + f] = `b${t}`; b[8 + f] = 'wP'; b[48 + f] = 'bP'; });
  return b;
})();
/** The board after a move the client already knows (castling rook, en passant, promotion), for previews and replay. */
function applyMove(board: (Piece | null)[], m: { from: string; to: string; promotion?: PromoType }): (Piece | null)[] {
  const b = board.slice(), f = idx(m.from), t = idx(m.to), p = b[f];
  if (!p) return board;
  if (p[1] === 'P' && f % 8 !== t % 8 && !b[t]) b[Math.floor(f / 8) * 8 + (t % 8)] = null; // en passant
  if (p[1] === 'K' && Math.abs((t % 8) - (f % 8)) === 2) { const r = t > f ? f + 3 : f - 4, to = t > f ? t - 1 : t + 1; b[to] = b[r]!; b[r] = null; } // castling rook
  b[t] = m.promotion ? (`${p[0]}${m.promotion}` as Piece) : p;
  b[f] = null;
  return b;
}
/** Boards after each ply, replayed from the standard start (null when the game started from another position). */
function replay(history: ChessView['history']): (Piece | null)[][] | null {
  const out = [START];
  for (const h of history) {
    const prev = out.at(-1)!;
    const p = prev[idx(h.from)];
    if (!p || p[0] !== h.color) return null;
    const promo = /=([QRBN])/.exec(h.san)?.[1] as PromoType | undefined;
    out.push(applyMove(prev, { from: h.from, to: h.to, ...(promo ? { promotion: promo } : {}) }));
  }
  return out;
}

// ---------- clock ----------
/** «۴:۰۵», under 10 s with tenths «۰:۰۹٫۴», over an hour «۱:۰۵:۰۰». Persian digits, read left to right. */
function clockText(ms: number): string {
  const v = Math.max(0, ms);
  if (v < 10_000) return `۰:۰${faNum(Math.floor(v / 1000))}٫${faNum(Math.floor((v % 1000) / 100))}`;
  const s = Math.ceil(v / 1000);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
  const two = (n: number) => faNum(n).padStart(2, '۰');
  return h ? `${faNum(h)}:${two(m)}:${two(ss)}` : `${faNum(m)}:${two(ss)}`;
}
const CLOCK_SR: Record<FrameClockState, string> = { pre: 'هنوز شروع نشده', idle: 'ایستاده', run: 'در حال کار', warn: 'وقت کم', crit: 'کمتر از ۱۰ ثانیه', flag: 'وقت تمام شد', off: 'بازیکن قطع است' };
function ChessClock({ color, clock, small }: { color: Color; clock: NonNullable<TableFrame['clocks']>[number]; small?: boolean }) {
  return (
    <span className={small ? 'ch-clock ch-clock--sm' : 'ch-clock'} data-clock={color} data-state={clock.state}
      role="timer" aria-label={`ساعت ${COLOR_FA[color]}: ${clockText(clock.ms)}، ${clock.first ? 'مهلت حرکت اول' : CLOCK_SR[clock.state]}`}>
      {clock.state === 'off' ? <Icon name="wifi-off" size={16} className="ch-clock__ic" /> : clock.state === 'run' || clock.state === 'warn' || clock.state === 'crit' ? <span className="ch-clock__tick" aria-hidden="true" /> : null}
      <span className="ch-clock__t" dir="ltr" aria-hidden="true">{clockText(clock.ms)}</span>
    </span>
  );
}

// ---------- player bar (CX-6) ----------
function PlayerBar({ seat, name, color, captured, lead, clock, small, off, set }: {
  seat?: TableFrameSeat; name: string; color: Color; captured: Piece[]; lead: number; clock?: NonNullable<TableFrame['clocks']>[number] | null; small?: boolean; off?: boolean; set: PieceSet;
}) {
  // Pieces this player captured (the opponent's colour); black ones sit on a light chip so they read on the felt (CX-6b).
  const sorted = [...captured].sort((a, b) => VALUE[a[1] as PieceType] - VALUE[b[1] as PieceType]);
  const capColor = sorted[0]?.[0] as Color | undefined;
  return (
    <div className={small ? 'ch-player ch-player--sm' : 'ch-player'} data-color={color} data-flip-anchor={`cap-${color === 'w' ? 'b' : 'w'}`}>
      {seat?.avatar ?? <Avatar size={small ? 'sm' : 'md'} initials={name.charAt(0)} />}
      <div className="ch-player__id">
        <div className="ch-player__name">
          <b><bdi>{name}</bdi></b>
          {typeof seat?.rating === 'number' && <span className="ch-rating">{faNum(seat.rating)}</span>}
          {seat?.league && LEAGUE_FA[seat.league] && <League tier={seat.league as 'gold'}>{LEAGUE_FA[seat.league]}</League>}
          {off && <span className="ch-pill ch-pill--off"><Icon name="wifi-off" size={12} />قطع</span>}
        </div>
        <div className="ch-player__caps" aria-label={captured.length ? `مهره‌های زده‌شده: ${captured.map(pieceLabel).join('، ')}` : undefined}>
          {sorted.length > 0 && (
            <span className={capColor === 'b' ? 'ch-player__captured ch-player__captured--b' : 'ch-player__captured'} aria-hidden="true">
              {sorted.map((p, i) => <img key={i} className="ch-capt" src={pieceSrc(p[1] as PieceType, p[0] as Color, set)} alt="" draggable={false} />)}
            </span>
          )}
          {lead > 0 && <span className="ch-lead" dir="ltr">+{faNum(lead)}</span>}
        </div>
      </div>
      {clock && <ChessClock color={color} clock={clock} small={small} />}
    </div>
  );
}

// ---------- end of game (CX-11) ----------
const DRAW_FA = { stalemate: 'پات شد', repetition: 'تکرار سه‌بارهٔ یک وضعیت', fiftyMove: 'قانون ۵۰ حرکت', material: 'مهرهٔ کافی برای مات نمانده', agreement: 'با توافق دو طرف' } as const;
function endWords(view: ChessView, mySeat: number | null, aborted: boolean): { title: string; reason: string; tone: 'win' | 'loss' | 'draw' | 'none' } | null {
  if (aborted) return { title: 'بازی لغو شد', reason: 'حرکت اول زده نشد. رتبه تغییر نمی‌کند.', tone: 'none' };
  const e = view.end;
  if (!e || !view.outcome) return null;
  const winnerSeat = view.outcome.placements.find((p) => p.place === 1 && view.outcome!.placements.filter((q) => q.place === 1).length === 1)?.seat;
  const drawReason = e.kind === 'draw' ? e.draw : undefined;
  // Armageddon: a draw of any kind is a win for Black (the outcome says so; the end still records the draw).
  if (drawReason && winnerSeat !== undefined) {
    const mine = mySeat !== null && winnerSeat === mySeat;
    return { title: mySeat === null ? `${COLOR_FA[view.colors[winnerSeat]!]} برد (آرماگدون)` : mine ? 'بردید (آرماگدون)' : 'باختید (آرماگدون)', reason: 'در آرماگدون مساوی یعنی برد سیاه', tone: mySeat === null ? 'none' : mine ? 'win' : 'loss' };
  }
  if (drawReason) {
    const flagged = view.colors.indexOf(view.turn); // the side to move ran out of time
    const timeoutMat = mySeat === null ? 'وقت یک طرف تمام شد، ولی حریف مهرهٔ کافی برای مات نداشت'
      : flagged === mySeat ? 'وقت شما تمام شد، ولی حریف مهرهٔ کافی برای مات نداشت' : 'وقت حریف تمام شد، ولی مهرهٔ کافی برای مات نداشتید';
    return { title: 'مساوی', reason: drawReason === 'timeoutMaterial' ? timeoutMat : DRAW_FA[drawReason], tone: 'draw' };
  }
  if (winnerSeat === undefined) return null;
  const by = e.kind;
  if (mySeat === null) {
    const w = COLOR_FA[view.colors[winnerSeat]!];
    return { title: `${w} برد`, reason: by === 'checkmate' ? `${w} مات کرد` : by === 'resign' ? 'تسلیم' : 'وقت تمام شد', tone: 'none' };
  }
  const won = winnerSeat === mySeat;
  const reason = by === 'checkmate' ? (won ? 'حریف را مات کردید' : 'مات شدید') : by === 'resign' ? (won ? 'حریف تسلیم شد' : 'تسلیم شدید') : (won ? 'وقت حریف تمام شد' : 'وقت شما تمام شد');
  return { title: won ? 'بردید!' : 'باختید', reason, tone: won ? 'win' : 'loss' };
}
const scoreText = (view: ChessView): string | null => {
  if (!view.outcome) return null;
  if (view.end?.kind === 'draw') return '½-½';
  const w = view.outcome.placements.find((p) => p.place === 1)?.seat;
  return w === undefined ? null : view.colors[w] === 'w' ? '1-0' : '0-1';
};

// ---------- renderer ----------
export default function ChessRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued, frame }: GameRendererProps<ChessView>) {
  const [prefs, setPrefs] = usePrefs();
  const phone = useNarrow(899);
  // Undo-window preview: the own move is already on the board (the server's answer will be the same board).
  const pending = queued?.type === 'move' ? (queued as unknown as MoveHint) : null;
  const liveView: ChessView = pending ? { ...real, board: applyMove(real.board, pending), lastMove: { from: pending.from, to: pending.to } } : real;
  const myColor: Color | null = mySeat === null ? null : liveView.colors[mySeat]!;
  const [flipped, setFlipped] = useState(false);
  const flip = (myColor === 'b') !== flipped; // you sit at the bottom; spectators see White's side and may turn the board
  const moves = useMemo(() => legalActions.filter((a) => a.type === 'move') as unknown as MoveHint[], [legalActions]);
  const has = (type: string) => legalActions.find((a) => a.type === type);
  const offerHint = has('offerDraw');
  const live = frame?.live ?? true;
  const over = !!liveView.outcome || !!frame?.finished;
  const aborted = !!frame?.aborted;
  const myTurn = mySeat !== null && liveView.current === mySeat && !pending && !over;
  const canAct = myTurn && !busy && live;
  const exp = expected as MoveHint | null;

  // Review: an earlier position from the move list (null = the live position).
  const [ply, setPly] = useState<number | null>(null);
  const boards = useMemo(() => replay(liveView.history), [liveView.history]);
  const reviewing = ply !== null && boards !== null && ply < liveView.history.length;
  const shownBoard = reviewing ? boards[ply]! : liveView.board;
  const shownLast = reviewing ? (ply > 0 ? liveView.history[ply - 1]! : null) : liveView.lastMove;

  const [selected, setSelected] = useState<string | null>(null);
  const [promoTo, setPromoTo] = useState<string | null>(null);
  const [premove, setPremove] = useState<Premove | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [settings, setSettings] = useState(false);
  const [options, setOptions] = useState(false);
  // A new move clears the selection, except a piece of your own picked just before your turn arrived (it stays picked).
  useEffect(() => {
    setSelected((sel) => (sel && !liveView.outcome && liveView.board[idx(sel)]?.[0] === myColor ? sel : null));
    setPromoTo(null); setPly(null);
  }, [liveView.history.length, liveView.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const targets = new Map(moves.filter((m) => m.from === selected).map((m) => [m.to, m]));
  const movable = new Set(moves.map((m) => m.from));
  const kingInCheck = !reviewing && liveView.inCheck ? liveView.board.findIndex((p) => p === `${liveView.turn}K`) : -1;
  // En passant (CX-2 is-ep): a diagonal pawn target on an empty square takes the pawn beside it (from the legal moves).
  const epVictim = (() => {
    if (!selected) return null;
    const p = liveView.board[idx(selected)];
    if (!p || p[1] !== 'P') return null;
    for (const m of targets.values()) if (m.from[0] !== m.to[0] && !liveView.board[idx(m.to)]) return m.to[0]! + m.from[1]!;
    return null;
  })();

  const send = useCallback((m: { from: string; to: string; promotion?: PromoType }) => {
    onAction({ type: 'move', from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) });
    setSelected(null); setPromoTo(null);
  }, [onAction]);
  const tryMove = (to: string) => {
    const m = targets.get(to);
    if (!m || !selected) return false;
    const promos = moves.filter((x) => x.from === selected && x.to === to && x.promotion);
    if (promos.length) { if (prefs.autoQueen) send({ from: selected, to, promotion: 'Q' }); else setPromoTo(to); }
    else send(m);
    return true;
  };
  // Premove (ENGINE.md §3): one move queued on the opponent's turn; sent the moment the turn arrives if it is legal.
  const canPremove = prefs.premove && mySeat !== null && !over && !myTurn && live && !reviewing;
  const ownPiece = (name: string) => { const p = liveView.board[idx(name)]; return !!p && p[0] === myColor; };
  const tap = (name: string) => {
    if (reviewing) { setPly(null); return; }
    if (canAct) {
      if (selected && tryMove(name)) return;
      setPromoTo(null);
      setSelected(movable.has(name) && name !== selected ? name : null);
      return;
    }
    if (canPremove) {
      if (selected && selected !== name && !ownPiece(name)) { setPremove({ from: selected, to: name }); setSelected(null); return; }
      if (!ownPiece(name)) { setPremove(null); setSelected(null); return; } // a tap on an empty square cancels
      setSelected(name === selected ? null : name);
    }
  };
  useEffect(() => {
    if (!premove || !myTurn || busy) return;
    const p = premove;
    setPremove(null);
    const legal = moves.filter((m) => m.from === p.from && m.to === p.to);
    if (!legal.length) return; // no longer legal: dropped silently
    send(legal.find((m) => m.promotion === 'Q') ?? legal[0]!); // a premove promotion is always a queen
  }, [myTurn, premove, moves, busy, send]);
  useEffect(() => { if (over) setPremove(null); }, [over]);

  // Drag (CX-1): press a piece, move, drop on a target; a press without movement is a click.
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: string; x: number; y: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ piece: Piece; x: number; y: number } | null>(null);
  const squareAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-sq]') as HTMLElement | null)?.dataset.sq ?? null;
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const sq = (e.target as HTMLElement).closest<HTMLElement>('[data-sq]')?.dataset.sq;
    if (!sq) return;
    const draggable = (canAct && movable.has(sq)) || (canPremove && ownPiece(sq));
    if (!draggable) return;
    drag.current = { from: sq, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    // Capture only once it is a drag: capturing on press would retarget the click of a plain tap to the board.
    if (!d.moved) { d.moved = true; setSelected(d.from); setPromoTo(null); boardRef.current?.setPointerCapture(e.pointerId); }
    setGhost({ piece: liveView.board[idx(d.from)]!, x: e.clientX, y: e.clientY });
    setHover(squareAt(e.clientX, e.clientY));
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null); setHover(null);
    if (!d?.moved) return; // a click: handled by the square's onClick
    const to = squareAt(e.clientX, e.clientY);
    if (!to || to === d.from) return;
    if (canAct) { if (!tryMove(to)) setSelected(null); }
    else if (canPremove && !ownPiece(to)) { setPremove({ from: d.from, to }); setSelected(null); }
  };

  // Keyboard review: ← / → step through the moves, Home / End jump (the board reads left to right).
  const total = liveView.history.length;
  const go = (n: number | null) => setPly(n === null || n >= total ? null : Math.max(0, n));
  const cur = ply ?? total;

  // Polite announcement of the latest move.
  const last = liveView.history.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(liveView.history.length);
  useEffect(() => {
    if (liveView.history.length > seen.current && last) setAnnounce(`${COLOR_FA[last.color]}: ${last.san}${liveView.inCheck && !liveView.outcome ? '، کیش' : ''}`);
    seen.current = liveView.history.length;
  }, [liveView.history.length, last, liveView.inCheck, liveView.outcome]);

  // Pieces glide square to square (castling rook and en passant included).
  const root = useRef<HTMLDivElement>(null);
  const ids = usePieceIds(shownBoard, (a, b) => Math.hypot((a % 8) - (b % 8), Math.floor(a / 8) - Math.floor(b / 8)));
  useFlip(root, `${cur}|${pending ? `${pending.from}${pending.to}` : ''}`);

  const rows = Array.from({ length: 8 }, (_, i) => (flip ? i : 7 - i));
  const cols = Array.from({ length: 8 }, (_, i) => (flip ? 7 - i : i));
  const topSeat = mySeat === null ? (flip ? liveView.colors.indexOf('w') : liveView.colors.indexOf('b')) : (flipped ? mySeat : 1 - mySeat);
  const bottomSeat = 1 - topSeat;
  const seatInfo = (s: number) => frame?.seats.find((x) => x.seat === s);
  const capturedBy = (s: number) => liveView.captured[liveView.colors[1 - s]!];
  const material = (s: number) => capturedBy(s).reduce((n, p) => n + VALUE[p[1] as PieceType], 0);
  const lead = (s: number) => Math.max(0, material(s) - material(1 - s));
  const opponentOff = mySeat !== null && !!seatInfo(1 - mySeat)?.offline && !over;

  // ---------- status (rail card / phone bar) ----------
  const turnName = liveView.current !== null ? seatName(liveView.current) : '';
  let status: { text: ReactNode; tone: 'turn' | 'wait' | 'check' | 'end' | 'off' };
  const ended = endWords(liveView, mySeat, aborted);
  if (ended) {
    const sc = scoreText(liveView);
    status = { tone: 'end', text: <><b>بازی تمام شد.</b> {ended.title === 'مساوی' ? `مساوی؛ ${ended.reason}` : ended.reason}{sc ? <> (<bdi dir="ltr">{sc}</bdi>)</> : null}.</> };
  } else if (mySeat === null) {
    status = { tone: 'wait', text: <><b>تماشا می‌کنید.</b> نوبت <bdi>{turnName}</bdi> ({COLOR_FA[liveView.turn]}).</> };
  } else if (myTurn && !live) {
    status = { tone: 'off', text: <><b>نوبت شماست.</b> تا وصل نشوید، حرکت‌ها فرستاده نمی‌شوند.</> };
  } else if (myTurn && promoTo) {
    status = { tone: 'turn', text: <>سرباز به خط آخر رسید. انتخاب کنید به چه مهره‌ای تبدیل شود.</> };
  } else if (myTurn && liveView.inCheck) {
    status = { tone: 'check', text: <><b>کیش!</b> شاه شما زیر حمله است. فقط حرکت‌هایی مجازند که کیش را رفع کنند.</> };
  } else if (myTurn && epVictim) {
    status = { tone: 'turn', text: <><b>آن‌پاسان ممکن است.</b> سرباز حریف همین الان دو خانه جلو آمد و کنار سرباز شما ایستاد؛ فقط در همین حرکت می‌توانید آن را بزنید.</> };
  } else if (myTurn && frame?.clocks?.[mySeat!]?.first) {
    // ENGINE.md P1: the bank waits until the first move; a missed first move aborts the game.
    status = { tone: 'turn', text: <><b>نوبت شماست.</b> برای حرکت اول {faNum(Math.ceil((frame.clocks[mySeat!]!.firstMs ?? 0) / 1000))} ثانیه وقت دارید؛ وگرنه بازی لغو می‌شود.</> };
  } else if (myTurn) {
    const crit = mySeat !== null && frame?.clocks?.[mySeat]?.state === 'crit';
    status = { tone: 'turn', text: crit ? <><b>کمتر از ۱۰ ثانیه وقت دارید.</b></> : <><b>نوبت شماست.</b> مهره را بکشید یا رویش کلیک کنید.</> };
  } else {
    const premoveSan = premove ? `${premove.from}-${premove.to}` : null;
    const oppFirst = liveView.current !== null && frame?.clocks?.[liveView.current]?.first;
    status = { tone: 'wait', text: oppFirst ? <><b>نوبت <bdi>{turnName}</bdi>.</b> منتظر حرکت اول حریف هستیم.</> : opponentOff ? <><b>نوبت <bdi>{turnName}</bdi>.</b> منتظر وصل شدن حریف هستیم.</>
      : premoveSan ? <><b>نوبت <bdi>{turnName}</bdi>.</b> پری‌موو شما آماده است: <bdi dir="ltr">{premoveSan}</bdi>. برای لغو، روی یک خانهٔ خالی بزنید.</>
        : <><b>نوبت <bdi>{turnName}</bdi>.</b></> };
  }

  // ---------- draw offer (CX-10) ----------
  const offerFrom = liveView.drawOffer;
  const offerCard = !over && offerFrom !== null && mySeat !== null ? (
    offerFrom === mySeat ? (
      <div className="ch-offer" data-offer="sent" role="status">
        <div className="ch-offer__t"><Icon name="handshake" size={20} /><span><b>پیشنهاد مساوی فرستاده شد.</b> منتظر جواب <bdi>{seatName(1 - mySeat)}</bdi> بمانید.</span></div>
        <p className="ch-note">تا ۵ حرکت دیگر نمی‌توانید دوباره پیشنهاد بدهید.</p>
      </div>
    ) : (
      <div className="ch-offer" data-offer="received" role="alert">
        <div className="ch-offer__t"><Icon name="handshake" size={20} /><b><bdi>{seatName(offerFrom)}</bdi> پیشنهاد مساوی داد.</b></div>
        <div className="ch-offer__row">
          <Button variant="primary" icon="check" disabled={busy || !live || !has('acceptDraw')} onClick={() => onAction({ type: 'acceptDraw' })}>قبول</Button>
          <Button variant="secondary" icon="x" disabled={busy || !live} onClick={() => onAction({ type: 'declineDraw' })}>رد</Button>
        </div>
        <p className="ch-note">اگر حرکت کنید، یعنی رد کرده‌اید.</p>
      </div>
    )
  ) : null;
  const drawSent = !over && offerFrom !== null && offerFrom === mySeat;
  const drawDisabled = busy || !live || over || !offerHint || !!offerHint.disabled;
  const claim = has('claimDraw');

  // ---------- move list (CX-7) ----------
  const pairs: { n: number; w?: { san: string; i: number }; b?: { san: string; i: number } }[] = [];
  liveView.history.forEach((h, i) => {
    const n = Math.floor((i + (liveView.history[0]?.color === 'b' ? 1 : 0)) / 2);
    pairs[n] ??= { n: n + 1 };
    pairs[n]![h.color] = { san: h.san, i };
  });
  const moveBtn = (m: { san: string; i: number } | undefined, empty: string) => m
    ? <button type="button" className={m.i === cur - 1 ? 'ch-ml__m is-cur' : 'ch-ml__m'} aria-current={m.i === cur - 1 || undefined} disabled={!boards} onClick={() => go(m.i + 1)} dir="ltr">{m.san}</button>
    : <span className="ch-ml__m ch-ml__m--empty" dir="ltr">{empty}</span>;
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (ply === null) listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' }); }, [total, ply]);
  const nav = (
    <div className="ch-nav" role="toolbar" aria-label="مرور حرکت‌ها" dir="ltr">
      <Button variant="ghost" size="sm" iconOnly icon="chevron-left" disabled={!boards || cur === 0} onClick={() => go(0)} aria-label="اولین حرکت">اولین حرکت</Button>
      <Button variant="ghost" size="sm" iconOnly icon="chevron-left" disabled={!boards || cur === 0} onClick={() => go(cur - 1)} aria-label="حرکت قبلی">حرکت قبلی</Button>
      <Button variant="ghost" size="sm" iconOnly icon="chevron-right" disabled={ply === null} onClick={() => go(cur + 1)} aria-label="حرکت بعدی">حرکت بعدی</Button>
      <Button variant="ghost" size="sm" iconOnly icon="chevron-right" disabled={ply === null} onClick={() => go(null)} aria-label="آخرین حرکت">آخرین حرکت</Button>
    </div>
  );
  const moveList = (
    <section className="ch-card ch-card--fill" aria-labelledby="ch-moves-h">
      <h3 id="ch-moves-h">حرکت‌ها</h3>
      <div className="ch-mlhead" aria-hidden="true"><span>#</span><span>{COLOR_FA.w}</span><span>{COLOR_FA.b}</span></div>
      {pairs.length ? (
        <ol className="ch-moves" ref={listRef}>
          {pairs.map((p) => <li key={p.n} className="ch-ml__row"><span className="ch-ml__n">{faNum(p.n)}.</span>{moveBtn(p.w, '…')}{moveBtn(p.b, '')}</li>)}
        </ol>
      ) : <p className="ch-note">هنوز حرکتی انجام نشده است.</p>}
      {nav}
    </section>
  );

  // ---------- board (CX-1..CX-4) ----------
  const promoFile = promoTo ? FILES.indexOf(promoTo[0]!) : -1;
  const promoCol = promoTo ? cols.indexOf(promoFile) : -1;
  const board = (
    <div className={`ch-boardwrap${!live && !over ? ' is-offline' : ''}`}>
      <div ref={boardRef} className="ch-board" data-theme-board={prefs.theme} role="grid" aria-label={`صفحهٔ شطرنج، از سمت ${COLOR_FA[flip ? 'b' : 'w']}${reviewing ? `؛ مرور حرکت ${faNum(ply)}` : ''}`} dir="ltr"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; setGhost(null); setHover(null); }}
        onContextMenu={(e) => { if (premove || selected) { e.preventDefault(); setPremove(null); setSelected(null); } }}>
        {rows.map((r) => (
          <div key={r} role="row" className="ch-row">
            {cols.map((f) => {
              const i = r * 8 + f;
              const name = sqName(i);
              const piece = shownBoard[i];
              const target = !reviewing && (canAct ? targets.get(name) : undefined);
              const preTarget = canPremove && selected && selected !== name && !ownPiece(name);
              const dark = (r + f) % 2 === 0;
              const cls = ['ch-sq', dark ? 'd' : 'l',
                prefs.last && shownLast && (shownLast.from === name || shownLast.to === name) ? 'is-last' : '',
                selected === name ? 'is-sel' : '',
                prefs.dots && target ? (piece ? 'is-cap' : 'is-dot') : '',
                prefs.dots && preTarget ? (piece ? 'is-cap' : 'is-dot') : '',
                i === kingInCheck ? 'is-check' : '',
                premove && (premove.from === name || premove.to === name) ? 'is-pre' : '',
                hover === name && drag.current ? 'is-hover' : '',
                epVictim === name ? 'is-ep' : '',
                exp && (exp.from === name || (selected === exp.from && exp.to === name)) ? 'is-hint' : ''].filter(Boolean).join(' ');
              const interactive = (canAct && (movable.has(name) || !!target)) || (canPremove && (ownPiece(name) || !!selected));
              return (
                <button key={f} type="button" role="gridcell" data-sq={name} className={cls} onClick={() => tap(name)}
                  aria-disabled={!interactive || undefined} aria-pressed={selected === name || undefined}
                  aria-label={`${name}، ${piece ? pieceLabel(piece) : 'خالی'}${target ? (piece ? '، زدن' : '، حرکت به اینجا') : ''}${i === kingInCheck ? '، کیش' : ''}${premove?.to === name ? '، پری‌موو' : ''}`}>
                  {piece && <img data-flip={ids[i]} data-flip-exit={`cap-${piece[0]}`} className={ghost && drag.current?.from === name ? 'ch-pc is-ghost' : 'ch-pc'} src={pieceSrc(piece[1] as PieceType, piece[0] as Color, prefs.set)} alt="" draggable={false} />}
                  {prefs.coords && f === cols[0] && <span className="ch-co ch-co--r" aria-hidden="true">{r + 1}</span>}
                  {prefs.coords && r === rows[7] && <span className="ch-co ch-co--f" aria-hidden="true">{FILES[f]}</span>}
                </button>
              );
            })}
          </div>
        ))}
        {promoTo && selected && (
          <>
            <div className="ch-scrim" onClick={() => setPromoTo(null)} aria-hidden="true" />
            <div className="ch-promo" data-promo={promoTo} role="group" aria-label="ارتقای سرباز" style={{ ['--f' as string]: promoCol }}>
              {(['Q', 'N', 'R', 'B'] as PromoType[]).map((t) => (
                <button key={t} type="button" className="ch-promo__p" disabled={busy} onClick={() => send({ from: selected, to: promoTo, promotion: t })} aria-label={NAME_FA[t]}>
                  <img className="ch-pc" src={pieceSrc(t, liveView.turn, prefs.set)} alt="" draggable={false} />
                </button>
              ))}
              <button type="button" className="ch-promo__x" onClick={() => setPromoTo(null)} aria-label="انصراف"><Icon name="x" size={18} /></button>
            </div>
          </>
        )}
        {ghost && <img className="ch-ghost" src={pieceSrc(ghost.piece[1] as PieceType, ghost.piece[0] as Color, prefs.set)} alt="" style={{ insetInlineStart: ghost.x, insetBlockStart: ghost.y }} />}
      </div>
      {/* CX-12: on top of the board, never over a player bar or clock. */}
      {!live && !over && (
        <div className="ch-banner ch-banner--lost" role="status">
          <span className="ch-spin" aria-hidden="true" />
          <span>{phone ? 'اتصال قطع شد. در حال وصل شدن دوباره…' : <><b>اتصال شما قطع شد.</b> در حال وصل شدن دوباره… ساعت شما همچنان کار می‌کند.</>}</span>
          {!phone && <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>تلاش دوباره</Button>}
        </div>
      )}
      {live && opponentOff && (
        <div className="ch-banner ch-banner--retry" role="status">
          <Icon name="wifi-off" size={18} />
          <span><b><bdi>{seatName(1 - mySeat!)}</bdi> قطع شد.</b> ساعتش کار می‌کند؛ اگر وقتش تمام شود، شما می‌برید.</span>
        </div>
      )}
      {(ended || aborted) && <EndPanel view={liveView} mySeat={mySeat} words={ended!} seatName={seatName} seatInfo={seatInfo} frame={frame} />}
    </div>
  );

  const bar = (s: number, small?: boolean) => (
    <PlayerBar seat={seatInfo(s)} name={seatName(s)} color={liveView.colors[s]!} captured={capturedBy(s)} lead={lead(s)} small={small}
      clock={frame?.clocks?.[s] ?? null} off={!!seatInfo(s)?.offline && !over} set={prefs.set} />
  );

  const statusCard = status && (
    <div className={`ch-status ch-status--${status.tone}`} role="status" aria-live="polite">
      {status.tone === 'turn' ? <span className="ch-dot-turn" aria-hidden="true" /> : status.tone === 'end' ? <Icon name="trophy" size={20} /> : status.tone === 'off' ? <Icon name="wifi-off" size={20} /> : status.tone === 'check' ? <Icon name="triangle-alert" size={20} /> : null}
      <span>{status.text}</span>
    </div>
  );

  const resignBtn = (block?: boolean) => <Button variant="leave" icon="flag" block={block} disabled={busy || !live || over || mySeat === null} onClick={() => setConfirmResign(true)}>تسلیم</Button>;
  const drawBtn = (block?: boolean) => <Button variant="secondary" icon="handshake" block={block} disabled={drawDisabled} onClick={() => onAction({ type: 'offerDraw' })}>{drawSent ? 'فرستاده شد' : 'مساوی'}</Button>;
  const flipBtn = <Button variant="secondary" iconOnly icon="rotate-ccw" pressed={flipped} onClick={() => setFlipped((f) => !f)}>چرخاندن صفحه</Button>;
  const settingsBtn = <Button variant="secondary" iconOnly icon="settings" onClick={() => setSettings(true)}>تنظیمات صفحه</Button>;

  const dialogs = (
    <>
      {confirmResign && (phone
        ? <Sheet title="تسلیم می‌شوید؟" icon="flag" onClose={() => setConfirmResign(false)}
            footer={<div className="ch-sheetbtns"><Button variant="danger" icon="flag" block onClick={() => { setConfirmResign(false); onAction({ type: 'resign' }); }}>تسلیم</Button><Button variant="secondary" block onClick={() => setConfirmResign(false)}>ادامهٔ بازی</Button></div>}>
            <p className="ch-note">بازی را می‌بازید.</p>
          </Sheet>
        : <Dialog title="تسلیم می‌شوید؟" icon="flag" danger onClose={() => setConfirmResign(false)}
            footer={<><Button variant="secondary" onClick={() => setConfirmResign(false)}>ادامهٔ بازی</Button><Button variant="danger" icon="flag" onClick={() => { setConfirmResign(false); onAction({ type: 'resign' }); }}>تسلیم</Button></>}>
            <p className="ch-note">بازی را می‌بازید.</p>
          </Dialog>)}
      {settings && <SettingsPanel phone={phone} prefs={prefs} setPrefs={setPrefs} onClose={() => setSettings(false)} />}
      {options && (
        <Sheet title="حرکت‌ها" icon="list" onClose={() => setOptions(false)}>
          <div className="ch-optsheet">
            {moveList}
            <div className="ch-optrow">
              <Button variant="secondary" icon="rotate-ccw" onClick={() => { setFlipped((f) => !f); setOptions(false); }}>چرخاندن صفحه</Button>
              <Button variant="secondary" icon="settings" onClick={() => { setOptions(false); setSettings(true); }}>تنظیمات</Button>
              {frame?.openChat && <Button variant="secondary" icon="message-circle" count={frame.unread} onClick={() => { setOptions(false); frame.openChat!(); }}>گفت‌وگو</Button>}
            </div>
          </div>
        </Sheet>
      )}
    </>
  );

  if (phone) {
    // Phone (P03…P19): board full width, opponent above, you below, status and move strip, 5-item dock.
    return (
      <div className="ch ch--phone" ref={root}>
        <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
        {bar(topSeat, true)}
        {board}
        {bar(bottomSeat, true)}
        {offerCard}
        {statusCard}
        {claim && canAct && <Button variant="secondary" icon="handshake" block onClick={() => onAction({ type: 'claimDraw' })}>ادعای مساوی (تکرار سه‌باره / ۵۰ حرکت)</Button>}
        {frame?.tournament}
        {pairs.length > 0 && (
          <ol className="ch-strip ch-moves" dir="ltr" aria-label="حرکت‌ها">
            {pairs.map((p) => <li key={p.n}><span className="ch-ml__n">{faNum(p.n)}.</span>{moveBtn(p.w, '…')}{p.b && moveBtn(p.b, '')}</li>)}
          </ol>
        )}
        <nav className="ch-pdock" aria-label="کنش‌های میز">
          <button type="button" onClick={() => setOptions(true)}><Icon name="more-vertical" size={22} /><span>گزینه‌ها</span></button>
          <button type="button" disabled={drawDisabled} onClick={() => onAction({ type: 'offerDraw' })}><Icon name="handshake" size={22} /><span>{drawSent ? 'فرستاده شد' : 'مساوی'}</span></button>
          <button type="button" disabled={busy || !live || over || mySeat === null} onClick={() => setConfirmResign(true)}><Icon name="flag" size={22} /><span>تسلیم</span></button>
          <button type="button" disabled={!boards || cur === 0} onClick={() => go(cur - 1)}><Icon name="chevron-right" size={22} /><span>قبلی</span></button>
          <button type="button" disabled={ply === null} onClick={() => go(cur + 1)}><Icon name="chevron-left" size={22} /><span>بعدی</span></button>
        </nav>
        {dialogs}
      </div>
    );
  }

  return (
    <div className="ch ch--desk" ref={root}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('input, textarea, select')) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
        else if (e.key === 'Home') go(0); else if (e.key === 'End') go(null);
      }}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      <aside className="ch-rail" aria-label="وضعیت و حرکت‌ها">
        <div className="ch-card">{statusCard}</div>
        {offerCard}
        {claim && canAct && <Button variant="secondary" icon="handshake" block onClick={() => onAction({ type: 'claimDraw' })}>ادعای مساوی (تکرار سه‌باره / ۵۰ حرکت)</Button>}
        {frame?.tournament}
        {moveList}
        <div className="ch-actions">{drawBtn()}{resignBtn()}{flipBtn}{settingsBtn}</div>
      </aside>
      <main className="ch-felt" aria-label="صفحهٔ بازی">
        {bar(topSeat)}
        {board}
        {bar(bottomSeat)}
      </main>
      {dialogs}
    </div>
  );
}

function EndPanel({ view, mySeat, words, seatName, seatInfo, frame }: {
  view: ChessView; mySeat: number | null; words: NonNullable<ReturnType<typeof endWords>>; seatName: (s: number) => string;
  seatInfo: (s: number) => TableFrameSeat | undefined; frame?: TableFrame;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return <button type="button" className="ch-endpeek" onClick={() => setHidden(false)}><Icon name="trophy" size={16} />{words.title}</button>;
  const winner = view.outcome?.placements.length && view.end?.kind !== 'draw' ? view.outcome.placements.find((p) => p.place === 1)?.seat : undefined;
  const white = view.colors.indexOf('w'), black = 1 - white;
  const sc = scoreText(view);
  const player = (s: number) => (
    <div className={winner === s ? 'ch-vs__p is-win' : 'ch-vs__p'}>
      {seatInfo(s)?.avatar ?? <Avatar size="md" initials={seatName(s).charAt(0)} />}
      <b><bdi>{seatName(s)}</bdi></b>
      {typeof seatInfo(s)?.rating === 'number' && <span className="ch-rating">{faNum(seatInfo(s)!.rating!)}</span>}
    </div>
  );
  return (
    <div className="ch-over">
      <section className="ch__end" data-end-kind={view.end?.kind ?? 'aborted'} data-end-draw={view.end?.draw ?? undefined} role="dialog" aria-labelledby="ch-end-h">
        <header className="ch__end-head">
          <Icon name={words.tone === 'win' ? 'crown' : words.tone === 'draw' ? 'handshake' : 'flag'} size={36} />
          <h3 id="ch-end-h">{words.title}</h3>
          <p>{words.reason}</p>
        </header>
        <div className="ch-vs">
          {player(mySeat ?? white)}
          <span className="ch-vs__score" dir="ltr" aria-label={sc ? `نتیجه ${sc} (سفید ـ سیاه)` : undefined}>{sc ?? '—'}</span>
          {player(mySeat === null ? black : 1 - mySeat)}
        </div>
        {frame?.result}
        <div className="ch__end-foot"><Button variant="ghost" size="sm" icon="eye" onClick={() => setHidden(true)}>دیدن صفحه</Button></div>
      </section>
    </div>
  );
}

function SettingsPanel({ phone, prefs, setPrefs, onClose }: { phone: boolean; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; onClose: () => void }) {
  // Chess-Spec §9 (not designed as a screen: built from the DS dialog/sheet pattern — for design review).
  const body = (
    <div className="ch-settings">
      <section aria-labelledby="ch-set-board">
        <h4 id="ch-set-board">صفحه</h4>
        <div className="ch-swatches" role="radiogroup" aria-label="تم صفحه">
          {THEMES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={prefs.theme === t} className="ch-swatch" onClick={() => setPrefs({ theme: t })}>
              <span className="ch-swatch__b" data-theme-board={t} aria-hidden="true"><i className="l" /><i className="d" /><i className="d" /><i className="l" /></span>
              {THEME_FA[t]}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="ch-set-pieces">
        <h4 id="ch-set-pieces">مهره‌ها</h4>
        <div className="ch-swatches" role="radiogroup" aria-label="مجموعهٔ مهره">
          {PIECE_SETS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={prefs.set === s} className="ch-swatch" onClick={() => setPrefs({ set: s })}>
              <span className="ch-swatch__p" aria-hidden="true"><img src={pieceSrc('N', 'w', s)} alt="" /><img src={pieceSrc('N', 'b', s)} alt="" /></span>
              {PIECE_SET_FA[s]}
            </button>
          ))}
        </div>
      </section>
      <section className="ch-switches" aria-label="گزینه‌ها">
        <Switch label="مختصات" checked={prefs.coords} onChange={(v) => setPrefs({ coords: v })} stateLabels={['خاموش', 'روشن']} />
        <Switch label="نمایش حرکت‌های مجاز" checked={prefs.dots} onChange={(v) => setPrefs({ dots: v })} stateLabels={['خاموش', 'روشن']} />
        <Switch label="برجسته کردن حرکت آخر" checked={prefs.last} onChange={(v) => setPrefs({ last: v })} stateLabels={['خاموش', 'روشن']} />
        <Switch label="پری‌موو" checked={prefs.premove} onChange={(v) => setPrefs({ premove: v })} stateLabels={['خاموش', 'روشن']} />
        <Switch label="ارتقای خودکار به وزیر" checked={prefs.autoQueen} onChange={(v) => setPrefs({ autoQueen: v })} stateLabels={['خاموش', 'روشن']} />
      </section>
      <Button variant="ghost" size="sm" icon="refresh-cw" onClick={() => setPrefs(DEFAULT_PREFS)}>بازگشت به پیش‌فرض</Button>
    </div>
  );
  return phone
    ? <Sheet title="تنظیمات صفحه" icon="settings" onClose={onClose}>{body}</Sheet>
    : <Dialog title="تنظیمات صفحه" icon="settings" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>باشه</Button>}>{body}</Dialog>;
}
