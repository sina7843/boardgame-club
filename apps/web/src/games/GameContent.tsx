// Game page blocks fed by the team's content (/games/:id/content) and players' reviews (/games/:id/reviews); markup and
// classes of design/reference/html/play/GameDetail-Desktop.html (styles in styles/home-ref.css).
import { useState, type CSSProperties } from 'react';
import type { GameContent, GameDetail, GameReviews } from '@bg/contracts';
import { Avatar, Button, Dialog, Icon, Textarea } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { DIFFICULTY_FA, faNum, jalaliDate, PACE_FA } from '../lib/format.ts';

const faDec = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 1 });
const span = (a: number, b: number) => (a === b ? faNum(a) : `${faNum(a)} تا ${faNum(b)}`);

export function Stars({ value, size }: { value: number; size?: 'sm' }) {
  return (
    <span className="gd-stars" role="img" aria-label={`${faNum(Math.round(value))} از ۵`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" {...(size ? { size } : {})} className={i <= Math.round(value) ? 'is-on' : undefined} />)}
    </span>
  );
}

/** «درباره»: the team's paragraphs (else the summary), highlight tiles and the first screenshot. */
export function AboutBody({ g, c }: { g: GameDetail; c: GameContent }) {
  const shot = c.screenshots[0];
  return (
    <>
      {(c.aboutFa.length ? c.aboutFa : [g.summaryFa]).map((p, i) => <p key={i} className="gd-desc gd-just gd-about__p">{p}</p>)}
      {c.highlights.length > 0 && (
        <div className="gd-eras">
          {c.highlights.map((h) => <div key={h.titleFa} className="gd-era"><span className="gd-era__ic"><Icon name="sparkles" /></span><b>{h.titleFa}</b><small className="gd-just">{h.textFa}</small></div>)}
        </div>
      )}
      {shot && (
        <figure className="gd-shot gd-shot--crop">
          <div className="gd-shot__frame"><img src={shot.src} alt={shot.captionFa} loading="lazy" /></div>
          <figcaption><Icon name="image" size="sm" />{shot.captionFa}</figcaption>
        </figure>
      )}
    </>
  );
}

/** Key moves as chips under «چطور بازی کنیم». */
export function Moves({ c }: { c: GameContent }) {
  if (!c.moves.length) return null;
  return (
    <div className="gd-cardhead gd-act7row">
      <span className="cx-b-muted">{faNum(c.moves.length)} حرکت اصلی:</span>
      <div className="gd-actions7">{c.moves.map((m) => <span key={m.labelFa}>{m.labelFa}{m.noteFa && <i>{m.noteFa}</i>}</span>)}</div>
    </div>
  );
}

/** «مشخصات بازی»: weight bar and the three numbers. */
export function SpecCard({ g, c }: { g: GameDetail; c: GameContent }) {
  const w = c.sheet.weight;
  return (
    <section className="gd-card gd-speccard">
      <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="gauge" />مشخصات بازی</h3></div>
      <div className="gd-weight">
        <div className="gd-weight__head"><span>سنگینی</span><b>{w !== null ? `${faDec(w)} از ۵` : DIFFICULTY_FA[g.difficulty]}</b></div>
        {w !== null && <>
          <div className="gd-weight__bar" role="img" aria-label={`سنگینی ${faDec(w)} از ۵`}><i style={{ inlineSize: `${((w - 1) / 4) * 100}%` } as CSSProperties} /></div>
          <div className="gd-weight__lbl"><span>سبک</span><span>سنگین</span></div>
        </>}
      </div>
      <ul className="gd-specs">
        <li><Icon name="users" /><span><small>{c.sheet.bestPlayersFa ? 'بهترین تعداد نفر' : 'تعداد نفر'}</small><b>{c.sheet.bestPlayersFa || `${span(g.minPlayers, g.maxPlayers)} نفر`}</b></span></li>
        {c.sheet.minAge !== null && <li><Icon name="user" /><span><small>سن</small><b>{faNum(c.sheet.minAge)} سال به بالا</b></span></li>}
        <li><Icon name="clock" /><span><small>مدت</small><b>{span(g.minMinutes, g.maxMinutes)} دقیقه</b></span></li>
      </ul>
    </section>
  );
}

/** «سازوکارها و دسته‌ها». */
export function TagsCard({ c }: { c: GameContent }) {
  const groups = ([['سازوکارها', c.sheet.mechanics], ['دسته‌ها', c.sheet.themes]] as const).filter(([, l]) => l.length);
  if (!groups.length) return null;
  return (
    <section className="gd-card">
      <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="layers" />سازوکارها و دسته‌ها</h3></div>
      {groups.map(([label, list]) => (
        <div key={label} className="gd-tgroup"><span className="gd-tgroup__l">{label}</span>
          <div className="gd-tags">{list.map((t) => <span key={t.fa} className="gd-tag">{t.fa}{t.en && <small dir="ltr">{t.en}</small>}</span>)}</div>
        </div>
      ))}
    </section>
  );
}

/** «اطلاعات بازی»: who made it, when, and how it plays here (time options, rule variants, rules version). */
export function InfoCard({ g, c }: { g: GameDetail; c: GameContent }) {
  const s = c.sheet;
  const rows: [string, string, React.ReactNode][] = [
    ...(s.designer ? [['user', 'طراح', s.designer] as [string, string, React.ReactNode]] : []),
    ...(s.artist ? [['palette', 'تصویرگری', s.artist] as [string, string, React.ReactNode]] : []),
    ...(s.publisher ? [['globe', 'ناشر', <>{s.publisher}</>] as [string, string, React.ReactNode]] : []),
    ...(s.publisherFa ? [['book-open', 'ناشر فارسی', s.publisherFa] as [string, string, React.ReactNode]] : []),
    ...(s.year ? [['calendar', 'سال انتشار', faNum(s.year).replace(/,/g, '')] as [string, string, React.ReactNode]] : []),
    ...g.paces.map((p) => ['clock', `زمان ${PACE_FA[p]}`, (p === 'live' ? g.liveSeconds : g.turnSeconds).map((x) => (x >= 3600 ? `${faNum(x / 3600)} ساعت` : x >= 60 ? `${faNum(x / 60)} دقیقه` : `${faNum(x)} ثانیه`)).join('، ')] as [string, string, React.ReactNode]),
    ...g.options.map((o) => ['sliders-horizontal', o.labelFa, o.hostChooses && o.choices.length > 1 ? `به انتخاب میزبان (${o.choices.map((x) => x.labelFa).join('، ')})` : o.choices.find((x) => x.value === o.default)?.labelFa ?? ''] as [string, string, React.ReactNode]),
    ['globe', 'وابستگی به زبان', 'در بردگیم‌ورس: کاملاً فارسی']
  ];
  return (
    <section className="gd-card gd-infocard">
      <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="info" />اطلاعات بازی</h3></div>
      <dl className="gd-info gd-info--2">{rows.map(([icon, dt, dd]) => <div key={dt}><dt><Icon name={icon} size="sm" />{dt}</dt><dd>{dd}</dd></div>)}</dl>
    </section>
  );
}

/** «نظر بازیکنان»: average, distribution, the latest reviews and «نظر بنویس» (after a finished table of the game). */
export function ReviewsCard({ gameId, data, signedIn, onChange }: { gameId: string; data: GameReviews | undefined; signedIn: boolean; onChange: (r: GameReviews) => void }) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const edit = () => { setStars(data.mine?.stars ?? 0); setBody(data.mine?.bodyFa ?? ''); setError(undefined); setOpen(true); };
  const save = async () => {
    setBusy(true); setError(undefined);
    try { onChange(await api<GameReviews>(`/games/${gameId}/reviews/mine`, { method: 'PUT', body: { stars, bodyFa: body } })); setOpen(false); }
    catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'نظر ثبت نشد.'); }
    finally { setBusy(false); }
  };
  const max = Math.max(1, ...data.distribution);
  return (
    <section className="gd-card gd-revcard" id="reviews">
      <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="message-circle" />نظر بازیکنان</h3></div>
      <div className="gd-revgrid">
        <div className="gd-rsum">
          <div className="gd-rsum__big"><b>{data.average !== null ? faDec(data.average) : '—'}</b><small>از ۵</small></div>
          <Stars value={data.average ?? 0} />
          <span>{faNum(data.count)} نظر</span>
          <ol className="gd-rdist">
            {data.distribution.map((n, i) => <li key={i}><span>{faNum(5 - i)}</span><div className="gd-rdist__bar"><i style={{ inlineSize: `${(n / max) * 100}%` }} /></div></li>)}
          </ol>
          {data.canReview
            ? <Button variant="secondary" icon="pencil" onClick={edit}>{data.mine ? 'ویرایش نظر شما' : 'نظر بنویس'}</Button>
            : <small className="bgv-muted">{signedIn ? 'بعد از اولین بازی کامل، می‌توانید نظر بنویسید.' : 'برای نظر دادن وارد شوید و یک دست بازی کنید.'}</small>}
        </div>
        {data.items.length === 0
          ? <p className="gd-just bgv-muted">هنوز نظری ثبت نشده است.</p>
          : data.items.slice(0, 3).map((r) => {
            const id = userIdentity({ displayName: r.user.displayName, avatarKey: r.user.avatarKey });
            return (
              <article key={r.id} className="gd-rev">
                <header>
                  <Avatar {...id.avatar} initials={id.initials} size="sm" />
                  <span className="gd-rev__who"><b><bdi>{r.user.displayName}</bdi></b><small>{jalaliDate(r.updatedAt)}</small></span>
                  <Stars value={r.stars} size="sm" />
                </header>
                <p className="gd-just">{r.bodyFa}</p>
              </article>
            );
          })}
      </div>
      {open && (
        <Dialog modal title={data.mine ? 'ویرایش نظر شما' : 'نظر شما دربارهٔ این بازی'} onClose={() => setOpen(false)}
          footer={<><Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button><Button variant="primary" loading={busy} disabled={!stars || body.trim().length < 3} onClick={save}>ثبت نظر</Button></>}>
          <div className="bgv-row" role="radiogroup" aria-label="امتیاز">
            {[1, 2, 3, 4, 5].map((i) => (
              <Button key={i} variant={i <= stars ? 'primary' : 'secondary'} size="sm" iconOnly icon="star" role="radio" aria-checked={i === stars} onClick={() => setStars(i)}>{`${faNum(i)} ستاره`}</Button>
            ))}
          </div>
          <Textarea label="نظر شما" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="چه چیزی این بازی را برایتان جذاب کرد؟" />
          {error && <p className="bgv-hint bgv-hint--error" role="alert">{error}</p>}
        </Dialog>
      )}
    </section>
  );
}
