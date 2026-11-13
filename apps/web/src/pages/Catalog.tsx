import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { GAME_TAG_FA, type GameSummary, type GameTag, type HomeOverview } from '@bg/contracts';
import { Button, Checkbox, Chip, Icon, Radio, Segmented, Select, Skeleton, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { DIFFICULTY_FA, faNum } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { popularOrder } from './Dashboard.tsx';

// Server-side filters (sent to /games) and client-side ones (`bot`, `sort`) that stay in the URL too.
type FilterKey = 'players' | 'maxMinutes' | 'difficulty' | 'mode' | 'access' | 'tags';
const SERVER_KEYS = ['q', 'players', 'maxMinutes', 'difficulty', 'mode', 'access', 'tags'];
const TAG_OPTIONS = (Object.keys(GAME_TAG_FA) as GameTag[]).map((value) => ({ value, label: GAME_TAG_FA[value] }));
const MODE_FA: Record<string, string> = { live: 'زنده', turn: 'نوبتی', friendly: 'دوستانه', ranked: 'رتبه‌دار' };
const PAGE = 12;

const SORTS: [string, string][] = [['popular', 'محبوب‌ترین'], ['name', 'نام'], ['time', 'کوتاه‌ترین'], ['players', 'کم‌نفرترین']];
const sortGames = (items: GameSummary[], sort: string) => {
  const by: Record<string, (a: GameSummary, b: GameSummary) => number> = {
    name: (a, b) => a.nameFa.localeCompare(b.nameFa, 'fa'), time: (a, b) => a.minMinutes - b.minMinutes, players: (a, b) => a.minPlayers - b.minPlayers
  };
  return by[sort] ? [...items].sort(by[sort]) : items;
};

/** The six category tiles under the hero (Catalog-Desktop): a tag (or «دونفره»), its icon on a seat colour, a peeking box. */
const CATS: { label: string; icon: string; seat: number; set: Record<string, string>; match: (g: GameSummary) => boolean }[] = [
  { label: 'استراتژیک', icon: 'map', seat: 6, set: { tags: 'strategy' }, match: (g) => g.tags.includes('strategy') },
  { label: 'خانوادگی', icon: 'house', seat: 2, set: { tags: 'family' }, match: (g) => g.tags.includes('family') },
  { label: 'کارتی', icon: 'layers', seat: 3, set: { tags: 'card' }, match: (g) => g.tags.includes('card') },
  { label: 'کلاسیک', icon: 'crown', seat: 9, set: { tags: 'classic' }, match: (g) => g.tags.includes('classic') },
  { label: 'دورهمی', icon: 'sparkles', seat: 7, set: { tags: 'party' }, match: (g) => g.tags.includes('party') },
  { label: 'دونفره', icon: 'swords', seat: 1, set: { players: '2' }, match: (g) => g.minPlayers <= 2 && g.maxPlayers >= 2 }
];
const span = (a: number, b: number) => (a === b ? faNum(a) : `${faNum(a)} تا ${faNum(b)}`);

/** «ویترین»: the week's six most played games, one at a time, with its boxes, numbers and the three ways in. */
function Showcase({ games, home, total }: { games: GameSummary[]; home: HomeOverview | undefined; total: number }) {
  const [i, setI] = useState(0);
  if (!games.length) return null;
  const g = games[i % games.length]!;
  const next = (d: number) => setI((x) => (x + d + games.length) % games.length);
  const back = [games[(i + 1) % games.length]!, games[(i + 2) % games.length]!];
  const seated = home?.queues[g.id]?.seated ?? 0;
  const box = (id: string) => `/covers/box/${id}.webp`;
  return (
    <section className="L-box L-band--felt gh-hero gh-a" data-theme="dark" aria-labelledby="gh-h1" aria-roledescription="ویترین">
      <div className="gh-a__top">
        <div className="gh-a__head">
          <h1 className="gh-kick" id="gh-h1"><img src="/brand/symbol-reversed-small.svg" alt="" />بازی‌ها<span className="gh-n">{faNum(total)} بازی</span></h1>
          <p>بردگیم‌های محبوب، نوبتی یا زنده؛ با دوستان یا با ربات.</p>
        </div>
        <div className="gh-a__nav">
          <span className="gh-dots" aria-hidden="true">{games.map((x, k) => <i key={x.id} className={k === i ? 'is-on' : undefined} />)}</span>
          <button type="button" className="gh-arrow" aria-label="بازی قبلی" onClick={() => next(-1)}><Icon name="chevron-right" /></button>
          <button type="button" className="gh-arrow" aria-label="بازی بعدی" onClick={() => next(1)}><Icon name="chevron-left" /></button>
        </div>
      </div>
      <div className="gh-a__stage" aria-live="polite">
        <div className="gh-a__info">
          <span className="L-kicker"><Icon name="star" size="sm" />{i === 0 ? 'بازی این هفته' : 'محبوب این هفته'}</span>
          <h2 className="gh-a__name">{g.nameFa}<small dir="ltr">{g.nameOriginal}</small></h2>
          <p className="gh-a__desc">{g.summaryFa}</p>
          <ul className="gh-stats">
            <li><Icon name="users" /><b>{span(g.minPlayers, g.maxPlayers)}</b><small>نفر</small></li>
            <li><Icon name="clock" /><b>{span(g.minMinutes, g.maxMinutes)}</b><small>دقیقه</small></li>
            <li><Icon name="gauge" /><b>{DIFFICULTY_FA[g.difficulty]}</b><small>سختی</small></li>
            <li><Icon name="armchair" /><b>{faNum(home?.openByGame[g.id] ?? 0)}</b><small>میز باز</small></li>
          </ul>
          <div className="gh-a__ctas">
            <Button variant="primary" size="lg" icon="zap" href={`/play?game=${g.id}`}>بازی سریع</Button>
            <Button variant="secondary" size="lg" icon="user-plus" href={`/games/${g.id}/new`}>میز بساز</Button>
            <a className="gh-tlink" href={`/games/${g.id}`}>صفحه بازی<Icon name="arrow-left" size="sm" /></a>
          </div>
        </div>
        <div className="gh-a__art" aria-hidden="true">
          <span className="gh-a__lamp" /><span className="gh-a__floor" />
          <span className="gh-a__box gh-a__box--b1"><img className="bgv-box" src={box(back[0]!.id)} alt="" /></span>
          <span className="gh-a__box gh-a__box--b2"><img className="bgv-box" src={box(back[1]!.id)} alt="" /></span>
          <span className="gh-a__box gh-a__box--main"><img className="bgv-box" src={box(g.id)} alt="" /></span>
          {seated > 0 && <span className="cx-e-proof gh-a__proof"><span className="cx-b-dot cx-b-dot--ok" /><span><b>{faNum(seated)}</b> نفر سر میز {g.nameFa}</span></span>}
        </div>
      </div>
      <ol className="gh-a__rail" aria-label="بازی‌های ویترین">
        {games.map((x, k) => (
          <li key={x.id}>
            <a className={k === i ? 'gh-thumb is-active' : 'gh-thumb'} href={`/games/${x.id}`} aria-current={k === i ? 'true' : undefined}
              onClick={(e) => { if (k !== i) { e.preventDefault(); setI(k); } }}>
              <span className="gh-thumb__box"><img className="bgv-box bgv-box--sm" src={box(x.id)} alt="" /></span>
              <span className="gh-thumb__t"><b>{x.nameFa}</b><small dir="ltr">{x.nameOriginal}</small></span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
const TIMES = [30, 60, 120];
const DIFF: [string, string][] = [['easy', 'آسان'], ['medium', 'متوسط'], ['hard', 'دشوار']];

export function Catalog() {
  usePageTitle('بازی‌ها', 'همه بردگیم‌های آنلاین | بردگیم‌ورس');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [shown, setShown] = useState(PAGE);

  // Debounced free-text search kept in the URL so results are shareable and survive reload.
  useEffect(() => {
    if (q.trim() === (params.get('q') ?? '')) return; // nothing to sync (a stray replace here could clobber a navigation already under way)
    const t = setTimeout(() => {
      setParams((p) => { const n = new URLSearchParams(p); if (q.trim()) n.set('q', q.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, setParams]);

  const setKey = (key: string, value: string) => {
    setShown(PAGE);
    setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });
  };
  const setFilter = (key: FilterKey, value: string) => setKey(key, value);

  const apiQs = new URLSearchParams([...params].filter(([k]) => SERVER_KEYS.includes(k))).toString();
  const { data, error, loading, reload } = useApi<{ items: GameSummary[] }>(`/games${apiQs ? `?${apiQs}` : ''}`);
  // Unfiltered list for the counts next to each filter and the preset art.
  const everything = useApi<{ items: GameSummary[] }>('/games');
  const all = useMemo(() => (everything.data?.items ?? []).filter((g) => !g.isTestGame), [everything.data]);
  const [moreTags, setMoreTags] = useState(false);
  const home = useApi<HomeOverview>('/home');
  const featuredAll = useMemo(() => popularOrder(all, home.data?.popular), [all, home.data]);
  const featured = featuredAll.slice(0, 6);
  const hasFilters = params.toString().replace(/(^|&)sort=[^&]*/, '').length > 0;
  const clear = () => { setQ(''); setShown(PAGE); setParams({}, { replace: true }); };
  const mode = params.get('mode');
  const onlyBot = params.get('bot') === '1';
  const sort = params.get('sort') ?? 'popular';
  const players = params.get('players') ?? '';

  // Test games (engine fixtures) are not part of the public list; their pages stay reachable by address.
  const items = useMemo(() => sortGames((data?.items ?? []).filter((g) => !g.isTestGame && (!onlyBot || g.botAvailable)), sort), [data, onlyBot, sort]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const live = mode === 'live' || mode === 'turn' ? mode : '';
  const tags = (params.get('tags') ?? '').split(',').filter((t): t is GameTag => t in GAME_TAG_FA);
  const tagCount = (t: string) => all.filter((g) => (g.tags as string[]).includes(t)).length;
  // Every active filter as a removable chip next to the count (Catalog-Desktop).
  const active: [string, string][] = [
    ...(mode ? [['mode', MODE_FA[mode] ?? mode] as [string, string]] : []),
    ...(players ? [['players', players === '6' ? '+۶ نفر' : `${faNum(Number(players))} نفر`] as [string, string]] : []),
    ...(params.get('maxMinutes') ? [['maxMinutes', `تا ${faNum(Number(params.get('maxMinutes')))} دقیقه`] as [string, string]] : []),
    ...(params.get('difficulty') ? [['difficulty', DIFF.find(([v]) => v === params.get('difficulty'))?.[1] ?? ''] as [string, string]] : []),
    ...(onlyBot ? [['bot', 'با ربات'] as [string, string]] : []),
    ...tags.map((t) => [`tag:${t}`, GAME_TAG_FA[t]] as [string, string])
  ];
  const dropFilter = (key: string) => key.startsWith('tag:') ? setFilter('tags', tags.filter((t) => t !== key.slice(4)).join(',')) : setKey(key, '');

  return (
    <>
      <div className="cx-catalog">
        <Showcase games={featured} home={home.data} total={all.length} />
        <nav className="bgv-tabs cx-tabs gh-tabs" aria-label="بخش‌ها">
          <a className="bgv-tab is-active" href="/games" aria-current="page">همه بازی‌ها</a>
          <a className="bgv-tab" href="/wiki"><Icon name="book-open" size="sm" />دانشنامه</a>
        </nav>
        <nav className="gh-cats" aria-label="دسته‌ها">
          {CATS.map((c) => {
            const list = featuredAll.filter(c.match);
            return (
              <a key={c.label} className="gh-cat" href={`/games?${new URLSearchParams(c.set)}`}
                onClick={(e) => { e.preventDefault(); setShown(PAGE); setParams(new URLSearchParams(c.set), { replace: true }); setQ(''); }}>
                <span className={`gh-cat__ic seat-${c.seat}`}><Icon name={c.icon} /></span>
                <span className="gh-cat__t"><b>{c.label}</b><small>{faNum(list.length)} بازی</small></span>
                {list[0] && <img className="gh-cat__peek" src={`/covers/box/${list[0].id}.webp`} alt="" loading="lazy" />}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="pg-catlayout">
        <search>
          <form className={`bgv-card pg-stack pg-catform${filtersOpen ? ' is-open' : ''}`} onSubmit={(e) => e.preventDefault()} aria-label="جست‌وجو و فیلتر بازی‌ها">
            <div className="bgv-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="t-title" style={{ margin: 0 }}><Icon name="sliders-horizontal" /> فیلترها</h2>
              {hasFilters && <Button size="sm" variant="ghost" onClick={clear}>پاک‌کردن</Button>}
            </div>
            <TextField label="جست‌وجو" icon="search" type="search" name="q" placeholder="نام فارسی یا اصلی" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button className="pg-filtbtn" icon="sliders-horizontal" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>فیلترهای بیشتر</Button>
            <div className="pg-filtbody">
              <div className="pg-stack" style={{ gap: 'var(--space-2)' }}>
                <span className="bgv-label">نوع بازی</span>
                <Segmented label="نوع بازی" block value={live} onChange={(v) => setFilter('mode', v)} options={[{ value: '', label: 'همه' }, { value: 'turn', label: 'نوبتی', icon: 'hourglass' }, { value: 'live', label: 'زنده', icon: 'zap' }]} />
              </div>
              <div className="pg-stack" style={{ gap: 'var(--space-2)' }}>
                <span className="bgv-label">تعداد نفر</span>
                <div className="bgv-chips" role="group" aria-label="تعداد نفر">
                  {[2, 3, 4, 5, 6].map((n) => <Chip key={n} selected={players === String(n)} onClick={() => setFilter('players', players === String(n) ? '' : String(n))}>{n === 6 ? '+۶' : faNum(n)}</Chip>)}
                </div>
              </div>
              <fieldset className="pg-flist" role="radiogroup" aria-label="زمان یک دست">
                <legend className="bgv-label">زمان یک دست</legend>
                {[0, ...TIMES].map((n) => (
                  <div key={n} className="pg-flist__row"><Radio name="maxMinutes" checked={(params.get('maxMinutes') ?? '') === (n ? String(n) : '')} onChange={() => setFilter('maxMinutes', n ? String(n) : '')} label={n ? `تا ${faNum(n)} دقیقه` : 'همه'} />
                    <span className="pg-flist__n">{faNum(n ? all.filter((g) => g.minMinutes <= n).length : all.length)}</span></div>
                ))}
              </fieldset>
              <fieldset className="pg-flist">
                <legend className="bgv-label">دشواری</legend>
                {DIFF.map(([v, label]) => (
                  <div key={v} className="pg-flist__row"><Checkbox checked={params.get('difficulty') === v} onChange={(e) => setFilter('difficulty', e.target.checked ? v : '')} label={label} />
                    <span className="pg-flist__n">{faNum(all.filter((g) => g.difficulty === v).length)}</span></div>
                ))}
              </fieldset>
              <div className="pg-stack" style={{ gap: 'var(--space-2)' }}>
                <span className="bgv-label">با ربات</span>
                <Switch label="فقط بازی‌هایی که ربات دارند" hint="برای تمرین، بدون انتظار" checked={onlyBot} onChange={(v) => setKey('bot', v ? '1' : '')} />
              </div>
              <fieldset className="pg-flist">
                <legend className="bgv-label">برچسب‌ها</legend>
                {[...TAG_OPTIONS].sort((a, b) => tagCount(b.value) - tagCount(a.value)).slice(0, moreTags ? undefined : 7).map((t) => (
                  <div key={t.value} className="pg-flist__row"><Checkbox checked={tags.includes(t.value)} onChange={(e) => setFilter('tags', (e.target.checked ? [...tags, t.value] : tags.filter((x) => x !== t.value)).join(','))} label={t.label} />
                    <span className="pg-flist__n">{faNum(tagCount(t.value))}</span></div>
                ))}
                {TAG_OPTIONS.length > 7 && <Button size="sm" variant="ghost" icon={moreTags ? 'chevron-up' : 'plus'} onClick={() => setMoreTags(!moreTags)}>{moreTags ? 'برچسب‌های کمتر' : `${faNum(TAG_OPTIONS.length - 7)} برچسب دیگر`}</Button>}
              </fieldset>
            </div>
          </form>
        </search>

        <div className="pg-stack" style={{ minInlineSize: 0 }}>
          {loading && !data && (
            <>
              <div className="bgv-grid" aria-hidden>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={300} radius="var(--radius-lg)" />)}</div>
              <span className="bgv-sr" role="status">در حال بارگذاری بازی‌ها…</span>
            </>
          )}
          {error && <StateBlock kind="error" title="فهرست بازی‌ها بارگذاری نشد" text={error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} />}
          {data && !error && (
            items.length === 0 ? (
              <StateBlock kind="empty" title="بازی‌ای با این مشخصات پیدا نشد"
                text={hasFilters ? 'فیلترها را کمتر کنید یا عبارت دیگری جست‌وجو کنید.' : 'هنوز بازی‌ای در کاتالوگ منتشر نشده است.'}
                action={hasFilters ? <Button onClick={clear}>پاک‌کردن فیلترها</Button> : undefined} />
            ) : (
              <>
                <div className="pg-results">
                  <b className="t-title" role="status" aria-live="polite">{faNum(items.length)} بازی</b>
                  {active.map(([k, label]) => <Chip key={k} size="sm" selected icon="x" onClick={() => dropFilter(k)} aria-label={`حذف فیلتر ${label}`}>{label}</Chip>)}
                  <span className="pg-results__sort"><Select label="مرتب‌سازی" value={sort} onChange={(e) => setKey('sort', e.target.value === 'popular' ? '' : e.target.value)} options={SORTS.map(([value, label]) => ({ value, label }))} /></span>
                </div>
                <div className="bgv-grid pg-catgrid" data-tour="catalog-grid">{items.slice(0, shown).map((g) => <GameCard key={g.id} game={g} />)}</div>
                {items.length > shown && (
                  <div className="pg-more">
                    <span className="t-caption bgv-muted">{faNum(Math.min(shown, items.length))} از {faNum(items.length)} بازی</span>
                    <Button onClick={() => setShown(shown + PAGE)}>نمایش {faNum(Math.min(PAGE, items.length - shown))} بازی دیگر</Button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}
