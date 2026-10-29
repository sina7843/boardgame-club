import { useMemo } from 'react';
import type { GameSummary, OpenTableItem, TournamentSummary } from '@bg/contracts';
import { Badge, Button, Card, Chip, Icon } from '@bg/ui/bgv';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDateTime } from '../lib/format.ts';

export type Facet = 'all' | 'duo' | 'party' | 'bot' | 'coop';
export const FACETS: [Facet, string, string][] = [
  ['all', 'همه', 'layout-grid'], ['duo', 'دونفره', 'swords'], ['party', 'مهمانی', 'users'], ['bot', 'با ربات', 'bot'], ['coop', 'همکاری', 'handshake']
];
export const inFacet = (g: GameSummary, f: Facet) =>
  f === 'all' || (f === 'duo' && g.maxPlayers === 2) || (f === 'party' && (g.tags.includes('party') || g.maxPlayers >= 5)) || (f === 'bot' && g.botAvailable) || (f === 'coop' && g.tags.includes('cooperative'));

/** Quick filters of the catalogue shelves, with counts. */
export function FacetChips({ games, value, onChange }: { games: GameSummary[]; value: Facet; onChange: (f: Facet) => void }) {
  return (
    <div className="bgv-chips" role="group" aria-label="دسته‌بندی بازی‌ها">
      {FACETS.map(([key, label, icon]) => (
        <Chip key={key} selected={value === key} icon={icon} onClick={() => onChange(key)}>{label} <span className="bgv-latin">{faNum(games.filter((g) => inFacet(g, key)).length)}</span></Chip>
      ))}
    </div>
  );
}

/** One home shelf: a titled row of game cards. */
export function Shelf({ id, icon, title, games, href = '/games', limit = 6 }: { id: string; icon: string; title: string; games: GameSummary[]; href?: string; limit?: number }) {
  if (!games.length) return null;
  return (
    <section className="bgv-stack" style={{ gap: 12 }} aria-labelledby={id}>
      <div className="hm-sechead">
        <h2 id={id} className="hm-h2"><Icon name={icon} />{title}</h2>
        <a className="hm-link" href={href}>همه<Icon name="chevron-left" size="sm" /></a>
      </div>
      <div className="hm-shelf">{games.slice(0, limit).map((g) => <GameCard key={g.id} game={g} />)}</div>
    </section>
  );
}

/** Games with the most open tables right now first (members only: the list needs an account), then catalogue order. */
export function popularGames(all: GameSummary[], open: OpenTableItem[]): GameSummary[] {
  const n = new Map<string, number>();
  for (const t of open) n.set(t.gameId, (n.get(t.gameId) ?? 0) + 1);
  return [...all].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0));
}

/** «میزهای باز همین حالا»: take a seat at a public table. */
export function OpenTablesRow({ items }: { items: OpenTableItem[] }) {
  if (!items.length) return null;
  return (
    <section className="bgv-stack" style={{ gap: 12 }} aria-labelledby="open-now-h">
      <div className="hm-sechead">
        <h2 id="open-now-h" className="hm-h2"><Icon name="armchair" />میزهای باز همین حالا</h2>
        <span className="t-caption bgv-muted">{faNum(items.length)} میز منتظر بازیکن است؛ با یک لمس بنشینید.</span>
        <a className="hm-link" href="/tables">همهٔ میزها<Icon name="chevron-left" size="sm" /></a>
      </div>
      <div className="hm-opengrid">
        {items.slice(0, 3).map((t) => (
          <Card key={t.id} className="hm-opencard">
            <div className="bgv-row" style={{ gap: 12 }}>
              <img className="hm-thumb" src={`/covers/${t.gameId}.webp?v=2`} alt="" loading="lazy" />
              <div className="bgv-stack" style={{ gap: 2, minInlineSize: 0 }}>
                <b>{t.gameNameFa}</b>
                <span className="hm-meta">میزبان <bdi>{t.host.displayName}</bdi></span>
              </div>
              <Badge size="sm">{faNum(t.players)} از {faNum(t.capacity)}</Badge>
            </div>
            <Button size="sm" variant="secondary" block icon="armchair" href={`/tables/${t.id}`}>بنشین</Button>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** The next tournament (open for registration or running) as a banner. */
export function TournamentBanner() {
  const t = useApi<{ items: TournamentSummary[] }>('/tournaments');
  const next = (t.data?.items ?? []).find((x) => x.status === 'open') ?? (t.data?.items ?? []).find((x) => x.status === 'running');
  if (!next) return null;
  const prize = next.prizes[0];
  return (
    <section className="hm-tourney" aria-labelledby="tourney-h">
      <img src={`/covers/${next.gameId}.webp?v=2`} alt="" loading="lazy" />
      <div className="hm-tourney__body">
        <Badge icon="trophy" size="sm">{next.status === 'open' ? 'تورنمنت این هفته' : 'در جریان'}</Badge>
        <h2 id="tourney-h" className="t-title">{next.titleFa}</h2>
        <p className="hm-meta">
          <span><Icon name="calendar" size="sm" /> {jalaliDateTime(next.startsAt)}</span>
          <span><Icon name="users" size="sm" /> {faNum(next.entrants)} از {faNum(next.maxEntrants)} نفر</span>
          {prize && prize.coins > 0 && <span><Icon name="coins" size="sm" /> جایزهٔ اول {faNum(prize.coins)} سکه</span>}
        </p>
        <div className="bgv-row">
          <Button variant="primary" href={`/tournaments/${next.id}`}>{next.entryKind === 'free' ? 'ثبت‌نام رایگان' : 'جزئیات و ثبت‌نام'}</Button>
          <a className="hm-link" href="/tournaments">همهٔ تورنمنت‌ها<Icon name="chevron-left" size="sm" /></a>
        </div>
      </div>
    </section>
  );
}

/** Guest home: three steps from nothing to a game. */
export function HowItWorks() {
  const steps: [string, string, string][] = [
    ['بازی را پیدا کن', 'میان بازی‌های محبوب جست‌وجو کن یا از دسته‌ها انتخاب کن؛ قوانین هر بازی در یک صفحه آمده است.', 'search'],
    ['میز بساز یا بنشین', 'پشت یک میز باز بنشین یا خودت میز بساز؛ ورود فقط وقتی لازم است که پشت میز می‌نشینی.', 'armchair'],
    ['دوستانت را دعوت کن', 'لینک میز را در تلگرام یا واتس‌اپ بفرست و با هم بازی کنید؛ زنده یا نوبتی در چند روز.', 'user-plus']
  ];
  return (
    <section className="bgv-stack" style={{ gap: 12 }} aria-labelledby="how-h">
      <h2 id="how-h" className="hm-h2"><Icon name="circle-help" />چطور کار می‌کند؟</h2>
      <div className="hm-steps">
        {steps.map(([title, text, icon], i) => (
          <Card key={title} className="hm-step">
            <span className="hm-step__n" aria-hidden>{faNum(i + 1)}</span>
            <div className="bgv-stack" style={{ gap: 4 }}>
              <b><Icon name={icon} size="sm" /> {title}</b>
              <p className="bgv-muted t-body-sm" style={{ margin: 0 }}>{text}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** Boxes of a few games for the guest hero. */
export function CoverCollage({ games }: { games: GameSummary[] }) {
  const picks = useMemo(() => games.slice(0, 4), [games]);
  return (
    <div className="hm-collage" aria-hidden>
      {picks.map((g, i) => <img key={g.id} className={`hm-collage__${i}`} src={`/covers/box/${g.id}.webp`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />)}
    </div>
  );
}
