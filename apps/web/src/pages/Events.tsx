// Time-limited events («رویداد»): list and one event's page. Points, goals and ranks come from the server.
import { useParams } from 'react-router';
import { MISSION_TYPE_FA, type EventDetail, type EventStatus, type EventSummary } from '@bg/contracts';
import { Badge, Button, Card, DataTable, Icon, Identity, PageHead, Progress, StateBlock } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { faNum, jalaliDateTime, remainingFa } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

const STATUS_FA: Record<EventStatus, string> = { live: 'در جریان', upcoming: 'به‌زودی', ended: 'پایان‌یافته' };
const STATUS_TONE = { live: 'success', upcoming: 'info', ended: 'neutral' } as const;

function When({ e }: { e: EventSummary }) {
  return (
    <span className="t-caption bgv-muted">
      {jalaliDateTime(e.startsAt)} تا {jalaliDateTime(e.endsAt)}
      {e.status === 'live' && <><span className="bgv-sep" />{remainingFa(e.endsAt)} مانده</>}
      {e.status === 'upcoming' && <><span className="bgv-sep" />{remainingFa(e.startsAt)} تا شروع</>}
    </span>
  );
}

function Meta({ e }: { e: EventSummary }) {
  return (
    <div className="bgv-row">
      <Badge tone={STATUS_TONE[e.status]} icon={e.status === 'live' ? 'zap' : 'calendar'}>{STATUS_FA[e.status]}</Badge>
      <span className="t-caption bgv-muted">{e.games ? e.games.map((g) => g.nameFa).join('، ') : 'همهٔ بازی‌ها'}</span>
      {e.reward && <Badge icon="gift">جایزه: {e.reward.slotFa} «{e.reward.nameFa}»</Badge>}
    </div>
  );
}

export function EventsPage() {
  usePageTitle('رویدادها');
  const list = useApi<{ items: EventSummary[] }>('/events');
  if (list.error) return <StateBlock kind="error" title="رویدادها دریافت نشد" text={list.error.messageFa} action={<Button variant="primary" onClick={list.reload}>تلاش دوباره</Button>} />;
  if (!list.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  return (
    <>
      <PageHead title="رویدادها" sub="رویدادهای زمان‌دار: در بازه‌ی رویداد بازی کنید، امتیاز بگیرید و با کامل کردن هدف‌ها جایزه ببرید." />
      {list.data.items.length === 0 ? <StateBlock kind="empty" title="فعلاً رویدادی نیست" text="رویدادهای تازه همین‌جا اعلام می‌شوند." action={<Button href="/progress">مأموریت‌های من</Button>} /> : (
        <div className="bgv-stack">{list.data.items.map((e) => (
          <Card key={e.slug} className="pf-pcard">
            <h2 className="pf-h2"><a href={`/events/${e.slug}`}>{e.titleFa}</a></h2>
            <Meta e={e} />
            <When e={e} />
            {e.descriptionFa && <p className="t-body-sm" style={{ margin: 0 }}>{e.descriptionFa}</p>}
          </Card>))}
        </div>
      )}
    </>
  );
}

export function EventPage() {
  const { slug = '' } = useParams();
  const { me } = useSession();
  const ev = useApi<EventDetail>(`/events/${encodeURIComponent(slug)}`);
  usePageTitle(ev.data?.titleFa ?? 'رویداد');
  if (ev.error) return <StateBlock kind={ev.error.status === 404 ? 'empty' : 'error'} title={ev.error.status === 404 ? 'رویداد پیدا نشد' : 'رویداد دریافت نشد'}
    action={ev.error.status === 404 ? <Button href="/events">همهٔ رویدادها</Button> : <Button variant="primary" onClick={ev.reload}>تلاش دوباره</Button>} />;
  if (!ev.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = ev.data;
  const done = d.goals.length > 0 && d.goals.every((g) => g.progress >= g.target);
  return (
    <>
      <PageHead title={d.titleFa} sub={d.descriptionFa || undefined} />
      <div className="bgv-cols pf-rankcols">
        <section className="bgv-card pf-pcard" aria-labelledby="ev-board-h">
          <h2 id="ev-board-h" className="pf-h2">جدول امتیاز</h2>
          {d.leaderboard.length === 0 ? <StateBlock kind="empty" title="هنوز امتیازی ثبت نشده" text="اولین بازی کامل در بازه‌ی رویداد، شما را در جدول می‌گذارد." /> : (
            <DataTable caption="جدول امتیاز رویداد" rowKey="rank" rows={d.leaderboard} youRow={(r) => r.user.id === me?.id} columns={[
              { key: 'rank', label: 'رتبه', strong: true, render: (r) => (r.rank === 1 ? <span className="pf-rank1" aria-label="رتبهٔ ۱"><Icon name="crown" size="sm" /></span> : faNum(r.rank)) },
              { key: 'user', label: 'بازیکن', render: (r) => <Identity {...userIdentity(r.user, { size: 'sm', you: r.user.id === me?.id, name: <a href={`/users/${r.user.id}`}><bdi>{r.user.displayName}</bdi></a> })} /> },
              { key: 'points', label: 'امتیاز', strong: true, render: (r) => <span className="bgv-num">{faNum(r.points)}</span> }
            ]} />
          )}
          {d.me?.rank && !d.leaderboard.some((r) => r.user.id === me?.id) && (
            <p className="pf-yourow"><b>{faNum(d.me.rank)}</b><bdi>{me?.displayName}</bdi><Badge size="sm" tone="you">شما</Badge><span className="bgv-spacer" /><span className="bgv-num">{faNum(d.me.points)}</span></p>
          )}
        </section>
        <aside className="bgv-stack" aria-label="هدف‌ها و قوانین">
          <section className="bgv-card pf-pcard" aria-labelledby="ev-info-h">
            <h2 id="ev-info-h" className="pf-h2">زمان و جایزه</h2>
            <Meta e={d} />
            <When e={d} />
            {d.me && <span className="t-label">امتیاز شما: <span className="bgv-num">{faNum(d.me.points)}</span>{d.me.rank && <><span className="bgv-sep" />رتبهٔ {faNum(d.me.rank)}</>}</span>}
          </section>
          {d.goals.length > 0 && (
            <section className="bgv-card pf-pcard" aria-labelledby="ev-goals-h">
              <div className="bgv-row"><h2 id="ev-goals-h" className="pf-h2">هدف‌ها</h2>
                {d.me?.rewardGranted ? <Badge tone="success" icon="check">جایزه گرفتید</Badge> : done ? <Badge tone="success" icon="check">کامل</Badge> : null}</div>
              {!me && <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>برای دیدن پیشرفت خودتان <a href={`/login?next=/events/${d.slug}`}>وارد شوید</a>.</p>}
              {d.goals.map((g) => (
                <div key={g.type} className="pf-mission">
                  <div className="bgv-row pf-mission__head"><b>{MISSION_TYPE_FA[g.type]}</b></div>
                  <div className="pf-mission__bar"><Progress aria-label={MISSION_TYPE_FA[g.type]} value={g.progress / Math.max(1, g.target)} />
                    <span className="t-caption bgv-muted bgv-num">{faNum(g.progress)} از {faNum(g.target)}</span></div>
                </div>))}
            </section>
          )}
          <section className="bgv-card pf-pcard" aria-labelledby="ev-rules-h">
            <h2 id="ev-rules-h" className="pf-h2">امتیازدهی</h2>
            <p className="t-body-sm" style={{ margin: 0 }}>
              هر بازی کامل با بازیکنان واقعی در بازه‌ی رویداد {faNum(d.rules.perGame)} امتیاز و رتبهٔ اول {faNum(d.rules.firstPlace)} امتیاز بیشتر دارد.
              بازی با ربات، بازی‌های تکراری با همان حریف‌ها و بازی‌های بعد از سقف روزانهٔ XP امتیاز ندارند. در امتیاز برابر، کسی بالاتر است که زودتر به آن رسیده باشد.
            </p>
            <a href="/events" className="t-label">همهٔ رویدادها</a>
          </section>
        </aside>
      </div>
    </>
  );
}
