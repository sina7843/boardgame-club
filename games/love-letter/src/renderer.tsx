// نامه عاشقانه renderer: parchment cards with a wax seal and a drawn emblem per role; opponents with their tokens,
// protection and discards; your two cards — tap one, then (if needed) a target and, for the Guard, a guess.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { CARD_FA, type LogEntry, type LoveLetterView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const EFFECT_FA: Record<number, string> = {
  1: 'کارت یک نفر را حدس بزنید', 2: 'دست یک نفر را ببینید', 3: 'دست‌ها را مقایسه کنید', 4: 'تا نوبت بعد در امانید',
  5: 'یک نفر کارتش را عوض کند', 6: 'دست‌تان را عوض کنید', 7: 'با شاه یا شاهزاده باید بازی شود', 8: 'دور بیندازید، می‌بازید'
};

function Emblem({ v }: { v: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (v) {
    case 1: return <path {...p} d="M20 6 L34 12 V24 C34 32 27 37 20 40 C13 37 6 32 6 24 V12 Z" />;
    case 2: return <g {...p}><path d="M20 6 V38 M10 16 H30" /><circle cx="20" cy="16" r="3" fill="currentColor" /></g>;
    case 3: return <g {...p}><path d="M8 34 L30 10 M26 8 L32 14 M12 26 L16 30" /><path d="M32 34 L10 10" opacity=".5" /></g>;
    case 4: return <g {...p}><circle cx="20" cy="17" r="8" /><path d="M20 25 V38 M20 31 Q14 29 12 33 M20 31 Q26 29 28 33" /></g>;
    case 5: return <path {...p} d="M8 30 L10 14 L16 22 L20 10 L24 22 L30 14 L32 30 Z" />;
    case 6: return <g {...p}><path d="M6 32 L8 12 L15 20 L20 6 L25 20 L32 12 L34 32 Z" /><path d="M6 36 H34" /></g>;
    case 7: return <g {...p}><path d="M6 18 Q20 8 34 18 Q20 30 6 18 Z" /><circle cx="14" cy="18" r="2.5" fill="currentColor" /><circle cx="26" cy="18" r="2.5" fill="currentColor" /></g>;
    default: return <g {...p}><path d="M20 36 C6 26 6 14 13 12 C17 11 20 15 20 15 C20 15 23 11 27 12 C34 14 34 26 20 36 Z" fill="currentColor" fillOpacity=".25" /><path d="M12 8 L16 12 L20 6 L24 12 L28 8" /></g>;
  }
}

function LLCard({ v, size = 'md', onClick, selected, hint, disabled }: { v: number; size?: 'sm' | 'md'; onClick?: () => void; selected?: boolean; hint?: boolean; disabled?: boolean }) {
  const body = (
    <>
      <span className="ll-card__v">{fa(v)}</span>
      <svg viewBox="0 0 40 44" className="ll-card__art" aria-hidden="true"><Emblem v={v} /></svg>
      <strong className="ll-card__name">{CARD_FA[v]}</strong>
      {size === 'md' && <small className="ll-card__fx">{EFFECT_FA[v]}</small>}
      <span className="ll-card__seal" aria-hidden="true" />
    </>
  );
  const cls = ['ll-card', `ll-card--${size}`, `ll-card--v${v}`, selected ? 'll-card--sel' : '', hint ? 'll-card--hint' : ''].join(' ');
  return onClick
    ? <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-pressed={selected} aria-label={`${CARD_FA[v]} (${fa(v)}): ${EFFECT_FA[v]}`}>{body}</button>
    : <span className={cls} aria-label={`${CARD_FA[v]} (${fa(v)})`}>{body}</span>;
}

export default function LoveLetterRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<LoveLetterView>) {
  const plays = legalActions.filter((a) => a.type === 'play') as unknown as { card: number; targets: number[] }[];
  const myTurn = plays.length > 0;
  const [card, setCard] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const lastSeq = view.log.at(-1)?.seq ?? 0;
  useEffect(() => { setCard(null); setTarget(null); }, [lastSeq, view.round]);
  const hint = expected?.type === 'play' ? (expected as unknown as { card: number; target?: number; guess?: number }) : null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const chosen = plays.find((p) => p.card === card);

  const send = (c: number, t?: number, g?: number) => {
    onAction({ type: 'play', card: c, ...(t !== undefined ? { target: t } : {}), ...(g !== undefined ? { guess: g } : {}) });
    setCard(null); setTarget(null);
  };
  const pickCard = (c: number) => {
    const opt = plays.find((p) => p.card === c)!;
    if (!opt.targets.length) return send(c); // no target needed (or nobody can be targeted)
    setCard(c); setTarget(null);
  };
  const pickTarget = (t: number) => { if (card === 1) setTarget(t); else send(card!, t); };

  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: card === null ? 'یک کارت را بازی کنید' : target === null ? 'هدف را انتخاب کنید' : 'کارت او را حدس بزنید' }
      : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : seatName(view.current)}` };

  const describe = (e: LogEntry) => {
    if (e.t === 'play') {
      const base = `${who(e.seat)} «${CARD_FA[e.card]}» بازی کرد${e.target !== null ? ` روی ${who(e.target)}` : ''}`;
      if (e.card === 1 && e.guess) return `${base} و «${CARD_FA[e.guess]}» گفت — ${e.result === 'out' ? 'درست بود!' : 'اشتباه بود'}`;
      if (e.result === 'tie') return `${base}: مساوی`;
      return base;
    }
    if (e.t === 'out') return `${who(e.seat)} با «${CARD_FA[e.card]}» از دور بیرون رفت`;
    if (e.t === 'round') return `دور ${fa(e.round)} را ${e.winners.map(who).join(' و ')} برد`;
    if (e.t === 'timeout') return `زمان ${who(e.seat)} تمام شد`;
    return `${who(e.seat)} کنار رفت`;
  };

  return (
    <div className="ll" data-seq={lastSeq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="ll__players" aria-label="بازیکنان">
        {view.tokens.map((t, s) => {
          const targetable = card !== null && chosen?.targets.includes(s) && target === null;
          return (
            <li key={s} className={['ll-pl', s === view.current && !view.outcome ? 'll-pl--turn' : '', view.inRound[s] ? '' : 'll-pl--out', s === mySeat ? 'll-pl--me' : ''].join(' ')}>
              <div className="ll-pl__head">
                <bdi className="ll-pl__name">{who(s)}</bdi>
                {view.protectedSeats[s] && <span className="ll-pl__shield" title="در امان">🛡</span>}
                {!view.inRound[s] && view.active[s] && <span className="ll-pl__state">بیرون از دور</span>}
                <span className="ll-pl__tokens" aria-label={`${fa(t)} نشان از ${fa(view.goal)}`}>
                  {Array.from({ length: view.goal }, (_, k) => <i key={k} className={k < t ? 'on' : ''} />)}
                </span>
              </div>
              <div className="ll-pl__discards">{view.discards[s]!.map((c, k) => <LLCard key={k} v={c} size="sm" />)}</div>
              {targetable && (
                <Button size="sm" className={hint?.target === s ? 'll-target--hint' : ''} disabled={busy} onClick={() => pickTarget(s)}>
                  {card === 5 && s === mySeat ? 'خودم' : `انتخاب ${who(s)}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="ll__table">
        <div className="ll-deck" aria-label={`${fa(view.deckCount)} کارت در دسته`}>
          <span className="ll-deck__back" /><span className="ll-deck__n">{fa(view.deckCount)}</span>
        </div>
        {view.faceUp.length > 0 && <div className="ll__faceup" aria-label="کارت‌های رو کنار گذاشته">{view.faceUp.map((c, k) => <LLCard key={k} v={c} size="sm" />)}</div>}
      </div>

      {view.seen && (
        <p key={view.seen.seq} className="ll__seen" role="status">
          فقط شما می‌بینید: کارت <bdi>{who(view.seen.seat)}</bdi> «{CARD_FA[view.seen.card]}» است.
        </p>
      )}

      {card === 1 && target !== null && (
        <div className="ll__guess" role="group" aria-label="حدس کارت">
          {[2, 3, 4, 5, 6, 7, 8].map((g) => (
            <button key={g} type="button" className={hint?.guess === g ? 'll-guess ll-guess--hint' : 'll-guess'} disabled={busy} onClick={() => send(1, target, g)}>
              {fa(g)} {CARD_FA[g]}
            </button>
          ))}
        </div>
      )}

      {view.hand && view.inRound[mySeat ?? 0] && !view.outcome && (
        <div className="ll__hand" role="group" aria-label="دست شما">
          {view.hand.map((c, k) => (
            <LLCard key={`${c}-${k}`} v={c} onClick={myTurn && plays.some((p) => p.card === c) && !busy ? () => pickCard(c) : undefined}
              selected={card === c} hint={hint?.card === c && card === null} />
          ))}
          {card !== null && <Button size="sm" variant="ghost" onClick={() => { setCard(null); setTarget(null); }}>انتخاب دوباره</Button>}
        </div>
      )}

      <ol className="ll__log" aria-label="رویدادها">{view.log.slice(-4).map((e) => <li key={e.seq}>{describe(e)}</li>)}</ol>
    </div>
  );
}
