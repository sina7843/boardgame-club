// Chess renderer: board from the viewer's side (Black sees rank 8 at the bottom), select a piece → its legal targets
// light up → tap a target (promotion asks for the piece). Board coordinates stay literal (dir=ltr); text is Persian.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { pieceSrc } from './pieces.tsx';
import type { ChessView, Color, Piece, PieceType, PromoType } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const FILES = 'abcdefgh';
const Glyph = ({ t, c }: { t: PieceType; c: Color }) => <img className="ch-pc" src={pieceSrc(t, c)} alt="" draggable={false} />;
const NAME_FA: Record<PieceType, string> = { K: 'شاه', Q: 'وزیر', R: 'رخ', B: 'فیل', N: 'اسب', P: 'سرباز' };
const COLOR_FA: Record<Color, string> = { w: 'سفید', b: 'سیاه' };
const DRAW_FA = { stalemate: 'پات', repetition: 'تکرار سه‌باره وضعیت', fiftyMove: 'قانون ۵۰ حرکت', material: 'مهره ناکافی برای مات', agreement: 'توافق دو بازیکن', timeoutMaterial: 'اتمام زمان، ولی حریف مهره کافی برای مات نداشت' } as const;
const pieceLabel = (p: Piece) => `${NAME_FA[p[1] as PieceType]} ${COLOR_FA[p[0] as Color]}`;
const sq = (i: number) => FILES[i % 8]! + String(Math.floor(i / 8) + 1);
type MoveHint = { type: 'move'; from: string; to: string; promotion?: PromoType };

export default function ChessRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<ChessView>) {
  const myColor: Color | null = mySeat === null ? null : view.colors[mySeat]!;
  const flip = myColor === 'b';
  const moves = useMemo(() => legalActions.filter((a) => a.type === 'move') as unknown as MoveHint[], [legalActions]);
  const canAcceptDraw = legalActions.some((a) => a.type === 'acceptDraw');
  const myTurn = mySeat !== null && view.current === mySeat;
  const exp = expected as MoveHint | null;

  const [selected, setSelected] = useState<string | null>(null);
  const [promoTo, setPromoTo] = useState<string | null>(null);
  const [offerDraw, setOfferDraw] = useState(false);
  useEffect(() => { setSelected(null); setPromoTo(null); setOfferDraw(false); }, [view.history.length, view.outcome]);

  const targets = new Map(moves.filter((m) => m.from === selected).map((m) => [m.to, m]));
  const movable = new Set(moves.map((m) => m.from));
  const kingInCheck = view.inCheck ? view.board.findIndex((p) => p === `${view.turn}K`) : -1;

  const send = (m: { from: string; to: string; promotion?: PromoType }) => {
    if (busy) return;
    onAction({ type: 'move', from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}), ...(offerDraw ? { offerDraw: true } : {}) });
    setSelected(null);
    setPromoTo(null);
  };
  const tap = (name: string) => {
    if (!myTurn || busy) return;
    if (selected && targets.has(name)) {
      const m = targets.get(name)!;
      if (m.promotion) setPromoTo(name);
      else send(m);
      return;
    }
    setPromoTo(null);
    setSelected(movable.has(name) && name !== selected ? name : null);
  };

  // Polite announcement of the latest move.
  const last = view.history.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(view.history.length);
  useEffect(() => {
    if (view.history.length > seen.current && last) setAnnounce(`${COLOR_FA[last.color]}: ${last.san}${view.inCheck && !view.outcome ? '، کیش' : ''}`);
    seen.current = view.history.length;
  }, [view.history.length, last, view.inCheck, view.outcome]);

  const rows = Array.from({ length: 8 }, (_, i) => (flip ? i : 7 - i));
  const cols = Array.from({ length: 8 }, (_, i) => (flip ? 7 - i : i));

  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome && view.current !== null) {
    const check = view.inCheck ? ' — کیش!' : '';
    status = myTurn ? { tone: 'mine', text: `نوبت شماست (${COLOR_FA[view.turn]})${check}` } : { tone: 'wait', text: `نوبت ${seatName(view.current)} (${COLOR_FA[view.turn]})${check}` };
  }
  const endText = view.end?.kind === 'checkmate' ? 'کیش و مات' : view.end?.kind === 'draw' ? `تساوی: ${DRAW_FA[view.end.draw!]}` : view.end?.kind === 'resign' ? 'انصراف' : view.end?.kind === 'timeout' ? 'اتمام زمان' : null;
  const opponent = mySeat === null ? 1 : 1 - mySeat;
  const bottomSeat = mySeat ?? 0;

  const pairs: [string, string | undefined][] = [];
  const firstBlack = view.history[0]?.color === 'b';
  const sans = view.history.map((h) => h.san);
  if (firstBlack) sans.unshift('…');
  for (let i = 0; i < sans.length; i += 2) pairs.push([sans[i]!, sans[i + 1]]);

  return (
    <div className="ch">
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {endText && <p className="ch__end">{endText}</p>}

      {view.drawOffer !== null && !view.outcome && (
        <div className="ch-offer" role="alert">
          {canAcceptDraw ? (
            <>
              <span><bdi>{seatName(view.drawOffer)}</bdi> پیشنهاد تساوی داده است. می‌توانید بپذیرید یا با یک حرکت آن را رد کنید.</span>
              <Button disabled={busy} onClick={() => onAction({ type: 'acceptDraw' })}>پذیرش تساوی</Button>
            </>
          ) : <span>{view.drawOffer === mySeat ? 'پیشنهاد تساوی شما ارسال شد.' : <><bdi>{seatName(view.drawOffer)}</bdi> پیشنهاد تساوی داده است.</>}</span>}
        </div>
      )}

      <div className="ch-main">
        <div className="ch-boardcol">
          <PlayerBar name={seatName(opponent)} color={view.colors[opponent]!} captured={view.captured[view.colors[1 - opponent]!]} active={view.current === opponent} />
          <div className="ch-frame" dir="ltr">
          {(['top', 'bottom'] as const).map((side) => <div key={side} className={`ch-edge ch-edge--files ch-edge--${side}`} aria-hidden="true">{cols.map((f) => <span key={f}>{FILES[f]}</span>)}</div>)}
          {(['start', 'end'] as const).map((side) => <div key={side} className={`ch-edge ch-edge--ranks ch-edge--${side}`} aria-hidden="true">{rows.map((r) => <span key={r}>{r + 1}</span>)}</div>)}
          <div className="ch-board" role="grid" aria-label={`صفحه شطرنج، از سمت ${COLOR_FA[myColor ?? 'w']}`} dir="ltr">
            {rows.map((r) => (
              <div key={r} role="row" className="ch-row">
                {cols.map((f) => {
                  const i = r * 8 + f;
                  const name = sq(i);
                  const piece = view.board[i];
                  const target = targets.get(name);
                  const dark = (r + f) % 2 === 0;
                  const cls = ['ch-sq', dark ? 'ch-sq--dark' : 'ch-sq--light',
                    selected === name ? 'ch-sq--sel' : '', target ? (piece ? 'ch-sq--capture' : 'ch-sq--target') : '',
                    view.lastMove && (view.lastMove.from === name || view.lastMove.to === name) ? 'ch-sq--last' : '',
                    i === kingInCheck ? 'ch-sq--check' : '',
                    exp && (exp.from === name || (selected === exp.from && exp.to === name)) ? 'ch-sq--hint' : ''].join(' ');
                  const interactive = myTurn && (movable.has(name) || !!target);
                  return (
                    <button key={f} type="button" role="gridcell" className={cls} onClick={() => tap(name)} aria-disabled={!interactive || busy || undefined}
                      aria-pressed={selected === name || undefined}
                      aria-label={`${name}، ${piece ? pieceLabel(piece) : 'خالی'}${target ? (piece ? '، زدن' : '، حرکت به اینجا') : ''}${i === kingInCheck ? '، کیش' : ''}`}>
                      {piece && <span className={`ch-piece ch-piece--${piece[0]}`} aria-hidden="true"><Glyph t={piece[1] as PieceType} c={piece[0] as Color} /></span>}
                      {f === (flip ? 7 : 0) && <span className="ch-coord ch-coord--rank" aria-hidden="true">{r + 1}</span>}
                      {r === (flip ? 7 : 0) && <span className="ch-coord ch-coord--file" aria-hidden="true">{FILES[f]}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
          <PlayerBar name={seatName(bottomSeat)} color={view.colors[bottomSeat]!} captured={view.captured[view.colors[1 - bottomSeat]!]} active={view.current === bottomSeat} me={mySeat !== null} />
        </div>

        <div className="ch-side">
          {promoTo && selected && (
            <section className="ch-panel ch-panel--decide" aria-label="ارتقای سرباز">
              <h3>ارتقای سرباز: کدام مهره؟</h3>
              <div className="ch-promo">
                {(['Q', 'R', 'B', 'N'] as PromoType[]).map((t) => (
                  <button key={t} type="button" className="ch-promo__btn" disabled={busy} onClick={() => send({ from: selected, to: promoTo, promotion: t })}>
                    <span className={`ch-piece ch-piece--${view.turn}`} aria-hidden="true"><Glyph t={t} c={view.turn} /></span>{NAME_FA[t]}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPromoTo(null)}>انصراف</Button>
            </section>
          )}
          {myTurn && !view.outcome && (
            <label className="ch-drawopt"><input type="checkbox" checked={offerDraw} onChange={(e) => setOfferDraw(e.target.checked)} /> همراه حرکتم پیشنهاد تساوی بده</label>
          )}
          {myTurn && !selected && <p className="ch-help">یک مهره خودی را بزنید تا خانه‌های مجاز روشن شوند.</p>}
          <section className="ch-panel" aria-labelledby="ch-moves-h">
            <h3 id="ch-moves-h">حرکت‌ها {view.halfmove >= 80 && !view.outcome ? <small>({fa(view.halfmove)} نیم‌حرکت بدون زدن یا حرکت سرباز)</small> : null}</h3>
            {pairs.length ? (
              <div className="ch-sheet" dir="ltr">
                <div className="ch-sheet__head" aria-hidden="true"><span>#</span><span>{COLOR_FA.w}</span><span>{COLOR_FA.b}</span></div>
                <ol className="ch-moves">
                  {pairs.map(([w, b], i) => <li key={i}><span className="ch-moves__n">{i + 1}.</span><span>{w}</span><span>{b ?? ''}</span></li>)}
                </ol>
              </div>
            ) : <p className="ch-help">هنوز حرکتی انجام نشده است.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function PlayerBar({ name, color, captured, active, me }: { name: string; color: Color; captured: Piece[]; active: boolean; me?: boolean }) {
  return (
    <div className={active ? 'ch-player ch-player--turn' : 'ch-player'}>
      <span className={`ch-player__swatch ch-player__swatch--${color}`} aria-hidden="true" />
      <bdi className="ch-player__name">{name}</bdi>
      <span className="ch-player__color">{COLOR_FA[color]}{me ? ' (شما)' : ''}</span>
      {captured.length > 0 && (
        <span className="ch-player__captured" aria-label={`مهره‌های زده‌شده: ${captured.map(pieceLabel).join('، ')}`}>
          {captured.map((p, i) => <span key={i} className={`ch-piece ch-piece--${p[0]}`} aria-hidden="true"><Glyph t={p[1] as PieceType} c={p[0] as Color} /></span>)}
        </span>
      )}
    </div>
  );
}
