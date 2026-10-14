import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { normalizeSearch, type GameSummary } from '@bg/contracts';
import { Button, Card, Chip, GameCard, PageHead, Select, Skeleton, StateBlock, TextField } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';
import { GameCover } from '../games/covers.tsx';

// Encyclopedia: a BoardGameGeek snapshot (scripts/bgg-sync.mjs → data/bgg.json) plus Persian text (data/bgg-fa.json)
// and Persian names for BGG categories/mechanics (data/bgg-terms-fa.json). Loaded lazily so it stays out of the main bundle.

type Link_ = { id: number; name: string };
type Bgg = {
  bggId: number; name: string; year: number | null; players: [number | null, number | null]; best: [number, number] | null;
  minutes: [number | null, number | null]; minAge: number | null; weight: number | null; rating: number | null; ratings: number;
  owned: number; rank: number | null; designers: Link_[]; artists: Link_[]; publishers: Link_[]; categories: Link_[]; mechanics: Link_[];
  honors: number; image: string | null;
};
type Fa = { taglineFa: string; aboutFa: string[] };
type Wiki = { fetchedAt: string; games: Record<string, Bgg>; fa: Record<string, Fa>; terms: Record<string, string> };

let wiki: Promise<Wiki> | undefined;
const loadWiki = () => (wiki ??= Promise.all([import('../data/bgg.json'), import('../data/bgg-fa.json'), import('../data/bgg-terms-fa.json')])
  .then(([b, f, t]) => ({ fetchedAt: b.default.fetchedAt, games: b.default.games as unknown as Record<string, Bgg>, fa: f.default as Record<string, Fa>, terms: t.default as Record<string, string> })));

function useWiki() {
  const [data, setData] = useState<Wiki>();
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadWiki().then(setData, () => { wiki = undefined; setFailed(true); }); }, []);
  return { data, failed };
}

const yearNum = (y: number) => Math.abs(y).toLocaleString('fa-IR', { useGrouping: false });
const yearFa = (y: number) => (y < 0 ? `حدود ${yearNum(y)} پیش از میلاد` : `${yearNum(y)} میلادی`);
const weightFa = (w: number) => `${w < 1.8 ? 'سبک' : w < 2.6 ? 'سبک تا متوسط' : w < 3.4 ? 'متوسط' : w < 4.2 ? 'سنگین' : 'خیلی سنگین'} (${faNum(w)} از ۵)`;
const span = ([a, b]: [number | null, number | null], unit: string) => (a && b && a !== b ? `${faNum(a)} تا ${faNum(b)} ${unit}` : a || b ? `${faNum((a || b)!)} ${unit}` : null);
const names = (l: Link_[]) => l.map((x, i) => <span key={x.id}>{i > 0 && '، '}<bdi>{x.name}</bdi></span>);
const bggUrl = (id: number) => `https://boardgamegeek.com/boardgame/${id}`;

function Terms({ items, terms, kind }: { items: Link_[]; terms: Record<string, string>; kind: 'category' | 'mechanic' }) {
  return (
    <ul className="pg-terms">{items.map((t) => (
      <li key={t.id}><Chip size="sm" href={`/wiki?${kind}=${t.id}`}>{terms[t.id] ?? <bdi>{t.name}</bdi>}</Chip></li>
    ))}</ul>
  );
}

/** Encyclopedia section on a game page; renders nothing for games without a BGG entry (e.g. test games). */
export function GameWiki({ gameId }: { gameId: string }) {
  const { data } = useWiki();
  const g = data?.games[gameId];
  // Links from the encyclopedia land on #wiki; the section only exists once the lazy data arrives.
  useEffect(() => { if (g && location.hash === '#wiki') document.getElementById('wiki')?.scrollIntoView(); }, [g]);
  if (!data || !g) return null;
  const fa = data.fa[gameId];
  const facts: [string, ReactNode][] = [
    ['نام اصلی', <bdi>{g.name}</bdi>],
    ['سال انتشار', g.year ? yearFa(g.year) : null],
    ['طراح', g.designers.length ? names(g.designers) : null],
    ['تصویرگر', g.artists.length ? names(g.artists) : null],
    ['ناشر', g.publishers.length ? names(g.publishers) : null],
    ['تعداد نفر (چاپی)', span(g.players, 'نفر')],
    ['بهترین تعداد', g.best ? span(g.best, 'نفر') : null],
    ['زمان (چاپی)', span(g.minutes, 'دقیقه')],
    ['سن', g.minAge ? `${faNum(g.minAge)} سال به بالا` : null],
    ['پیچیدگی', g.weight ? weightFa(g.weight) : null],
    ['امتیاز کاربران', g.rating ? `${faNum(g.rating)} از ۱۰ (${faNum(g.ratings)} رأی)` : null],
    ['رتبهٔ کلی BGG', g.rank ? faNum(g.rank) : null],
    ['جوایز و نامزدی‌ها', g.honors ? faNum(g.honors) : null]
  ];
  return (
    <div id="wiki"><Card title="دانشنامه">
      <div className="pg-stack">
        {fa?.taglineFa && <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>{fa.taglineFa}</p>}
        {fa?.aboutFa.map((p, i) => <p key={i} className="t-body" style={{ margin: 0 }}>{p}</p>)}
        <dl className="pg-sum">{facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {g.categories.length > 0 && <><h3 className="pg-h3">دسته‌ها</h3><Terms items={g.categories} terms={data.terms} kind="category" /></>}
        {g.mechanics.length > 0 && <><h3 className="pg-h3">سازوکارها</h3><Terms items={g.mechanics} terms={data.terms} kind="mechanic" /></>}
        <p className="bgv-hint">
          منبع اطلاعات: <a href={bggUrl(g.bggId)} target="_blank" rel="noopener noreferrer"><bdi>BoardGameGeek</bdi></a>،
          به‌روزرسانی {jalaliDate(data.fetchedAt)}. مشخصات «چاپی» مربوط به نسخهٔ رومیزی است و ممکن است با تنظیمات این سایت فرق کند.
        </p>
      </div>
    </Card></div>
  );
}

type Sort = 'rank' | 'rating' | 'weight' | 'year';
const SORTS: Record<Sort, (a: Bgg, b: Bgg) => number> = {
  rank: (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9),
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  weight: (a, b) => (b.weight ?? 0) - (a.weight ?? 0),
  year: (a, b) => (b.year ?? -1e9) - (a.year ?? -1e9)
};

function termOptions(data: Wiki | undefined, pick: (g: Bgg) => Link_[]) {
  const seen = new Map<number, string>();
  for (const g of Object.values(data?.games ?? {})) for (const t of pick(g)) seen.set(t.id, data!.terms[t.id] ?? t.name);
  return [...seen].map(([id, label]) => ({ value: String(id), label })).sort((a, b) => a.label.localeCompare(b.label, 'fa'));
}

export function WikiPage() {
  usePageTitle('دانشنامه');
  const { data, failed } = useWiki();
  const games = useApi<{ items: GameSummary[] }>('/games');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const set = (key: string, value: string) =>
    setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });
  const category = params.get('category') ?? '', mechanic = params.get('mechanic') ?? '';
  const sort = (params.get('sort') as Sort | null) ?? 'rank';

  const entries = useMemo(() => {
    if (!data || !games.data) return [];
    const text = normalizeSearch(q);
    return games.data.items.flatMap((s) => (data.games[s.id] ? [{ s, g: data.games[s.id]!, fa: data.fa[s.id] }] : []))
      .filter(({ s, g }) => (!text || normalizeSearch(`${s.nameFa} ${s.nameOriginal} ${g.name} ${g.designers.map((d) => d.name).join(' ')}`).includes(text))
        && (!category || g.categories.some((c) => String(c.id) === category))
        && (!mechanic || g.mechanics.some((m) => String(m.id) === mechanic)))
      .sort((a, b) => (SORTS[sort] ?? SORTS.rank)(a.g, b.g));
  }, [data, games.data, q, category, mechanic, sort]);

  const categories = useMemo(() => termOptions(data, (g) => g.categories), [data]);
  const mechanics = useMemo(() => termOptions(data, (g) => g.mechanics), [data]);

  const clear = () => { setQ(''); setParams({}, { replace: true }); };
  return (
    <>
      <PageTabs group="games" />
      <PageHead title="دانشنامهٔ بازی‌ها" sub={<>تاریخچه، طراحان، پیچیدگی، امتیاز و سازوکار بازی‌های سایت، برگرفته از <bdi>BoardGameGeek</bdi>.</>} />
      <search>
        <form className="pg-filters" onSubmit={(e) => e.preventDefault()} aria-label="جست‌وجو در دانشنامه" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
          <div className="pg-q" style={{ gridColumn: 'span 2' }}><TextField label="جست‌وجو" icon="search" type="search" placeholder="نام بازی یا طراح" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select label="دسته" value={category} onChange={(e) => set('category', e.target.value)} options={[{ value: '', label: 'همه' }, ...categories]} />
          <Select label="سازوکار" value={mechanic} onChange={(e) => set('mechanic', e.target.value)} options={[{ value: '', label: 'همه' }, ...mechanics]} />
          <Select label="مرتب‌سازی" value={sort} onChange={(e) => set('sort', e.target.value === 'rank' ? '' : e.target.value)}
            options={[{ value: 'rank', label: 'رتبهٔ BGG' }, { value: 'rating', label: 'امتیاز کاربران' }, { value: 'weight', label: 'پیچیدگی' }, { value: 'year', label: 'جدیدترین' }]} />
        </form>
      </search>
      {failed || games.error ? (
        <StateBlock kind="error" title="دانشنامه بارگذاری نشد" text={games.error?.messageFa} action={<Button onClick={() => location.reload()}>تلاش دوباره</Button>} />
      ) : !data || !games.data ? (
        <><div className="bgv-grid" aria-hidden>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={300} radius="var(--radius-lg)" />)}</div><span className="pg-sr" role="status">در حال بارگذاری دانشنامه…</span></>
      ) : entries.length === 0 ? (
        <StateBlock kind="empty" title="موردی پیدا نشد" text="عبارت یا فیلتر دیگری را امتحان کنید." action={<Button onClick={clear}>پاک‌کردن فیلترها</Button>} />
      ) : (
        <>
          <b className="t-body" role="status" aria-live="polite">{faNum(entries.length)} بازی</b>
          <div className="bgv-grid pg-wiki">{entries.map(({ s, g, fa }) => (
            <GameCard key={s.id} href={`/games/${s.id}#wiki`} art={<GameCover gameId={s.id} title="" />} title={s.nameFa} latin={g.name}
              aria-label={`${s.nameFa} (${g.name})`}
              meta={[
                ...(g.year ? [{ text: yearFa(g.year) }] : []),
                ...(g.rating ? [{ icon: 'star', text: faNum(g.rating) }] : []),
                ...(g.weight ? [{ icon: 'gauge', text: `پیچیدگی ${faNum(g.weight)} از ۵` }] : []),
                ...(g.rank ? [{ icon: 'trophy', text: `رتبهٔ ${faNum(g.rank)}` }] : []),
                ...(g.designers[0] ? [{ icon: 'pencil', text: <bdi>{g.designers[0].name}</bdi> }] : [])
              ]}
              footer={fa?.taglineFa ? <p className="pg-wiki__tag">{fa.taglineFa}</p> : undefined} />
          ))}</div>
          <p className="bgv-hint">داده‌ها از <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer"><bdi>BoardGameGeek</bdi></a>، به‌روزرسانی {jalaliDate(data.fetchedAt)}.</p>
        </>
      )}
    </>
  );
}
