// کاغذ و دریا renderer: origami on a paper sea. Folded-paper cards in their colour with a geometric creature, the
// deck and two discard piles, the private draw-two choice, and your hand where two cards make a duo. Once you have 7
// points «بس!» and «آخرین فرصت» appear.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import crab from './art/crab.webp';
import boat from './art/boat.webp';
import fish from './art/fish.webp';
import swimmer from './art/swimmer.webp';
import shark from './art/shark.webp';
import shell from './art/shell.webp';
import octopus from './art/octopus.webp';
import penguin from './art/penguin.webp';
import sailor from './art/sailor.webp';
import lighthouse from './art/lighthouse.webp';
import shoal from './art/shoal.webp';
import colony from './art/colony.webp';
import captain from './art/captain.webp';
import mermaid from './art/mermaid.webp';
import { CARDS, duoKind, type Kind, type SspView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const KIND_FA: Record<Kind, string> = {
  crab: 'خرچنگ', boat: 'قایق', fish: 'ماهی', swimmer: 'شناگر', shark: 'کوسه', shell: 'صدف', octopus: 'هشت‌پا', penguin: 'پنگوئن',
  sailor: 'ملوان', lighthouse: 'فانوس', shoal: 'دسته‌ماهی', colony: 'کلونی', captain: 'ناخدا', mermaid: 'پری دریایی'
};
// Origami art is cut from a generated sprite sheet (see DECISIONS.md).
const ART: Record<Kind, string> = {
  crab, boat, fish, swimmer, shark, shell, octopus,
  penguin, sailor, lighthouse, shoal, colony, captain, mermaid
};

export function PaperCard({ id, size = 'md', from }: { id: number; size?: 'sm' | 'md'; from?: string }) {
  const c = CARDS[id]!;
  return (
    <span className={`sp2-card sp2-card--${size} sp2-c--${c.color}`} data-flip={from ? `c-${id}` : undefined} data-flip-from={from} aria-label={KIND_FA[c.kind]}>
      <img src={ART[c.kind]} className="sp2-card__art" alt="" aria-hidden="true" draggable={false} />
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
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const actor = view.last ? (view.last.seat === me ? 'hand' : `seat-${view.last.seat}`) : 'deck';
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
    <div className="sp2" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="sp2__round">دست {fa(view.round)}، هدف {fa(view.target)} امتیاز</p>

      <ul className="sp2__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.scores.map((_, k) => k)).map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['sp2-pl', view.current === s && !view.outcome ? 'sp2-pl--turn' : '', s === mySeat ? 'sp2-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'sp2-pl--win' : ''].join(' ')}>
            <div className="sp2-pl__head"><bdi className="sp2-pl__name">{who(s)}</bdi><span className="sp2-pl__score bg-pop" key={view.scores[s]}>{fa(view.scores[s]!)}</span><span>{fa(view.handCount[s]!)} کارت در دست</span></div>
            {view.played[s]!.length > 0 && <div className="sp2-pl__played">{view.played[s]!.map((id) => <PaperCard key={id} id={id} size="sm" from={s === me ? 'hand' : `seat-${s}`} />)}</div>}
          </li>
        ))}
      </ul>

      {!view.outcome && (
        <section className="sp2__sea" aria-label="دسته و کپه‌ها">
          <button type="button" data-flip-anchor="deck" className={['sp2-deck', hint?.type === 'draw' ? 'sp2-hint' : ''].join(' ')} disabled={!has('draw') || busy} onClick={() => onAction({ type: 'draw' })}>
            <span className="sp2-deck__back" /><span>دسته: {fa(view.deckCount)}</span>
          </button>
          {([0, 1] as const).map((pile) => {
            const top = view.piles[pile];
            const canPut = keep && kept !== null && (keep.mustPile < 0 || keep.mustPile === pile);
            return (
              <button key={pile} type="button" className={['sp2-pile', takes.has(pile) || canPut ? 'sp2-pile--can' : '', hint?.type === 'take' && hint.pile === pile ? 'sp2-hint' : ''].join(' ')}
                disabled={busy || !(takes.has(pile) || canPut)} onClick={() => (canPut ? onAction({ type: 'keep', card: kept!, pile }) : onAction({ type: 'take', pile }))}
                aria-label={canPut ? `گذاشتن روی کپهٔ ${fa(pile + 1)}` : `برداشتن از کپهٔ ${fa(pile + 1)}`}>
                {top !== null ? <PaperCard id={top} from={actor} /> : <span className="sp2-pile__empty">خالی</span>}
                <small>{fa(view.pileCounts[pile])} کارت</small>
              </button>
            );
          })}
        </section>
      )}

      {view.drawn && keep && (
        <div className="sp2__choice" role="group" aria-label="کارت‌های کشیده‌شده">
          {view.drawn.map((id) => (
            <button key={id} type="button" className={`sp2-pick ${kept === id ? 'sp2-pick--on' : ''}`} aria-pressed={kept === id} onClick={() => setKept(kept === id ? null : id)}><PaperCard id={id} from="deck" /></button>
          ))}
          <span className="sp2__note">{kept === null ? 'کدام را نگه می‌دارید؟' : 'حالا کپه را بزنید'}</span>
        </div>
      )}

      {view.crabCards && (
        <div className="sp2__choice" role="group" aria-label="کارت‌های کپه">
          {view.crabCards.map((id) => <button key={id} type="button" className="sp2-pick" disabled={busy} onClick={() => onAction({ type: 'crabTake', card: id })}><PaperCard id={id} from="deck" /></button>)}
        </div>
      )}

      {view.hand && !view.outcome && (
        <section className="sp2__me" aria-label="دست شما">
          <p className="sp2__pts">امتیاز این دست: <b>{fa(view.myPoints ?? 0)}</b></p>
          <div className="sp2__hand" data-flip-anchor="hand">
            {view.hand.map((id) => (
              <button key={id} type="button" className={`sp2-pick ${sel.includes(id) ? 'sp2-pick--on' : ''}`} aria-pressed={sel.includes(id)} disabled={!has('duo') || busy}
                onClick={() => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id].slice(-2))}><PaperCard id={id} from="deck" /></button>
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
