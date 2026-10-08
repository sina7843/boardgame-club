// کاغذ و دریا renderer: origami on a paper sea. Folded-paper cards in their colour with a geometric creature, the
// deck and two discard piles, the private draw-two choice, and your hand where two cards make a duo. Once you have 7
// points «بس!» and «آخرین فرصت» appear.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { CARDS, duoKind, type Kind, type SspView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const KIND_FA: Record<Kind, string> = {
  crab: 'خرچنگ', boat: 'قایق', fish: 'ماهی', swimmer: 'شناگر', shark: 'کوسه', shell: 'صدف', octopus: 'هشت‌پا', penguin: 'پنگوئن',
  sailor: 'ملوان', lighthouse: 'فانوس', shoal: 'دسته‌ماهی', colony: 'کلونی', captain: 'ناخدا', mermaid: 'پری دریایی'
};
const SHAPE: Record<Kind, string> = {
  crab: 'M-9 4 L-4 -3 L4 -3 L9 4 L4 7 L-4 7 Z M-9 4 L-12 -4 M9 4 L12 -4', boat: 'M-10 2 L10 2 L6 8 L-6 8 Z M0 2 L0 -10 L7 0 Z',
  fish: 'M-9 0 L0 -6 L7 0 L0 6 Z M7 0 L11 -5 L11 5 Z', swimmer: 'M-10 3 L-3 -2 L4 1 L10 -3 M-2 -5 L1 -8 L3 -5 Z', shark: 'M-11 4 L9 4 L4 -1 L0 -9 L-3 -1 Z',
  shell: 'M0 8 L-9 -2 L-5 -7 L0 -9 L5 -7 L9 -2 Z M0 8 L0 -9 M0 8 L-5 -7 M0 8 L5 -7', octopus: 'M-7 -1 L0 -9 L7 -1 L5 3 L8 9 L3 4 L0 9 L-3 4 L-8 9 L-5 3 Z',
  penguin: 'M0 -9 L5 -3 L5 6 L0 9 L-5 6 L-5 -3 Z M-2 -6 L2 -6', sailor: 'M-6 -4 L6 -4 L4 -9 L-4 -9 Z M-4 -4 L-5 8 L5 8 L4 -4',
  lighthouse: 'M-3 9 L-5 -2 L5 -2 L3 9 Z M-3 -2 L-2 -7 L2 -7 L3 -2 M-9 -6 L-3 -5 M9 -6 L3 -5', shoal: 'M-10 -3 L-5 -6 L-1 -3 L-5 0 Z M1 3 L6 0 L10 3 L6 6 Z M-6 5 L-2 3 L1 5 L-2 7 Z',
  colony: 'M-6 -7 L-3 -3 L-3 6 L-9 6 L-9 -3 Z M5 -7 L8 -3 L8 6 L2 6 L2 -3 Z', captain: 'M-8 -2 L8 -2 L6 -8 L-6 -8 Z M-6 -2 L-6 8 L6 8 L6 -2 M-2 -6 L2 -6',
  mermaid: 'M0 -9 L4 -5 L2 0 L5 6 L9 9 L0 7 L-9 9 L-5 6 L-2 0 L-4 -5 Z'
};

export function PaperCard({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  const c = CARDS[id]!;
  return (
    <span className={`sp2-card sp2-card--${size} sp2-c--${c.color}`} aria-label={KIND_FA[c.kind]}>
      <svg viewBox="-14 -14 28 28" aria-hidden="true"><path d={SHAPE[c.kind]} className="sp2-card__fold" /></svg>
      {size === 'md' && <small>{KIND_FA[c.kind]}</small>}
    </span>
  );
}

export default function SspRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SspView>) {
  const me = mySeat ?? -1;
  const has = (t: string, call?: string) => legalActions.some((a) => a.type === t && (call === undefined || a.call === call));
  const takes = new Set(legalActions.filter((a) => a.type === 'take').map((a) => a.pile as number));
  const keep = legalActions.find((a) => a.type === 'keep') as { options: number[]; mustPile: number } | undefined;
  const [sel, setSel] = useState<number[]>([]);
  const [kept, setKept] = useState<number | null>(null);
  useEffect(() => { setSel([]); setKept(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; pile?: number; call?: string } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const duo = sel.length === 2 ? duoKind(sel[0]!, sel[1]!) : null;
  const myTurn = view.current === mySeat && !view.outcome;
  const status = view.outcome ? null
    : myTurn ? {
      tone: 'mine' as const,
      text: view.phase === 'draw' ? (view.lastChance ? 'آخرین فرصت! دو کارت از دسته یا کارت یک کپه' : 'دو کارت از دسته یا کارت روی یک کپه')
        : view.phase === 'choose' ? 'یکی را نگه دارید و دیگری را روی یک کپه بگذارید'
          : view.phase === 'crab' ? 'از کپه یک کارت بردارید' : 'جفت‌ها را بازی کنید یا نوبت را تمام کنید'
    }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}${view.lastChance ? ` (آخرین فرصتِ ${who(view.lastChance.caller)})` : ''}` };

  return (
    <div className="sp2" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="sp2__round">دست {fa(view.round)}، هدف {fa(view.target)} امتیاز</p>

      <ul className="sp2__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.scores.map((_, k) => k)).map((s) => (
          <li key={s} className={['sp2-pl', view.current === s && !view.outcome ? 'sp2-pl--turn' : '', s === mySeat ? 'sp2-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'sp2-pl--win' : ''].join(' ')}>
            <div className="sp2-pl__head"><bdi className="sp2-pl__name">{who(s)}</bdi><span className="sp2-pl__score" key={view.scores[s]}>{fa(view.scores[s]!)}</span><span>{fa(view.handCount[s]!)} کارت در دست</span></div>
            {view.played[s]!.length > 0 && <div className="sp2-pl__played">{view.played[s]!.map((id) => <PaperCard key={id} id={id} size="sm" />)}</div>}
          </li>
        ))}
      </ul>

      {!view.outcome && (
        <section className="sp2__sea" aria-label="دسته و کپه‌ها">
          <button type="button" className={['sp2-deck', hint?.type === 'draw' ? 'sp2-hint' : ''].join(' ')} disabled={!has('draw') || busy} onClick={() => onAction({ type: 'draw' })}>
            <span className="sp2-deck__back" /><span>دسته: {fa(view.deckCount)}</span>
          </button>
          {([0, 1] as const).map((pile) => {
            const top = view.piles[pile];
            const canPut = keep && kept !== null && (keep.mustPile < 0 || keep.mustPile === pile);
            return (
              <button key={pile} type="button" className={['sp2-pile', takes.has(pile) || canPut ? 'sp2-pile--can' : '', hint?.type === 'take' && hint.pile === pile ? 'sp2-hint' : ''].join(' ')}
                disabled={busy || !(takes.has(pile) || canPut)} onClick={() => (canPut ? onAction({ type: 'keep', card: kept!, pile }) : onAction({ type: 'take', pile }))}
                aria-label={canPut ? `گذاشتن روی کپهٔ ${fa(pile + 1)}` : `برداشتن از کپهٔ ${fa(pile + 1)}`}>
                {top !== null ? <PaperCard id={top} /> : <span className="sp2-pile__empty">خالی</span>}
                <small>{fa(view.pileCounts[pile])} کارت</small>
              </button>
            );
          })}
        </section>
      )}

      {view.drawn && keep && (
        <div className="sp2__choice" role="group" aria-label="کارت‌های کشیده‌شده">
          {view.drawn.map((id) => (
            <button key={id} type="button" className={`sp2-pick ${kept === id ? 'sp2-pick--on' : ''}`} aria-pressed={kept === id} onClick={() => setKept(kept === id ? null : id)}><PaperCard id={id} /></button>
          ))}
          <span className="sp2__note">{kept === null ? 'کدام را نگه می‌دارید؟' : 'حالا کپه را بزنید'}</span>
        </div>
      )}

      {view.crabCards && (
        <div className="sp2__choice" role="group" aria-label="کارت‌های کپه">
          {view.crabCards.map((id) => <button key={id} type="button" className="sp2-pick" disabled={busy} onClick={() => onAction({ type: 'crabTake', card: id })}><PaperCard id={id} /></button>)}
        </div>
      )}

      {view.hand && !view.outcome && (
        <section className="sp2__me" aria-label="دست شما">
          <p className="sp2__pts">امتیاز این دست: <b>{fa(view.myPoints ?? 0)}</b></p>
          <div className="sp2__hand">
            {view.hand.map((id) => (
              <button key={id} type="button" className={`sp2-pick ${sel.includes(id) ? 'sp2-pick--on' : ''}`} aria-pressed={sel.includes(id)} disabled={!has('duo') || busy}
                onClick={() => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id].slice(-2))}><PaperCard id={id} /></button>
            ))}
            {!view.hand.length && <span className="sp2__note">دستتان خالی است</span>}
          </div>
          {has('duo') && duo && (
            <div className="sp2__bar">
              {duo === 'crab' && ([0, 1] as const).map((pile) => <Button key={pile} size="sm" disabled={busy || !view.pileCounts[pile]} onClick={() => onAction({ type: 'duo', cards: [sel[0]!, sel[1]!], pile })}>خرچنگ‌ها: کپهٔ {fa(pile + 1)}</Button>)}
              {duo === 'shark' && view.scores.map((_, k) => k).filter((k) => k !== me && view.handCount[k]).map((k) => <Button key={k} size="sm" disabled={busy} onClick={() => onAction({ type: 'duo', cards: [sel[0]!, sel[1]!], target: k })}>دزدی از <bdi>{who(k)}</bdi></Button>)}
              {(duo === 'boat' || duo === 'fish') && <Button size="sm" disabled={busy || (duo === 'fish' && !view.deckCount)} onClick={() => onAction({ type: 'duo', cards: [sel[0]!, sel[1]!] })}>بازی جفت {duo === 'boat' ? '(نوبت اضافه)' : '(یک کارت از دسته)'}</Button>}
            </div>
          )}
          {view.phase === 'act' && myTurn && (
            <div className="sp2__bar">
              <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'end' && hint.call === 'pass' ? 'sp2-hint' : ''} onClick={() => onAction({ type: 'end', call: 'pass' })}>{view.extraTurn ? 'نوبت اضافه' : 'پایان نوبت'}</Button>
              {has('end', 'stop') && <Button size="sm" disabled={busy} className={hint?.call === 'stop' ? 'sp2-hint' : ''} onClick={() => onAction({ type: 'end', call: 'stop' })}>بس!</Button>}
              {has('end', 'last') && <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'end', call: 'last' })}>آخرین فرصت</Button>}
            </div>
          )}
        </section>
      )}

      {view.roundLog.length > 0 && (
        <table className="sp2__log"><thead><tr><th scope="col">دست</th>{view.scores.map((_, k) => <th key={k} scope="col"><bdi>{who(k)}</bdi></th>)}</tr></thead>
          <tbody>{view.roundLog.map((r, i) => <tr key={i}><th scope="row">{fa(i + 1)} {r.call === 'stop' ? 'بس' : r.call === 'last' ? 'آخرین فرصت' : 'دسته تمام شد'}</th>{r.gains.map((g, k) => <td key={k}>{fa(g)}</td>)}</tr>)}</tbody></table>
      )}
    </div>
  );
}
