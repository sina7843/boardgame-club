import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Banner, Button, Card, Identity, PageHead, Skeleton, StateBlock } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

interface LiveTable { id: string; gameNameFa: string; pace: 'live' | 'turn'; players: string[]; tournament: { id: string; titleFa: string; round: number } | null }
interface OpenTable { id: string; gameId: string; gameNameFa: string; pace: 'live' | 'turn'; players: number; capacity: number; turnSeconds: number; host: { displayName: string; avatarKey: string } }

export function OpenTables() {
  usePageTitle('میزهای باز');
  const { me, status } = useSession();
  const navigate = useNavigate();
  const list = useApi<{ items: OpenTable[] }>(me ? '/tables' : null);
  const live = useApi<{ items: LiveTable[] }>(me ? '/tables/live' : null);
  const [joining, setJoining] = useState<string>();
  const [error, setError] = useState<string>();

  if (status !== 'loading' && !me) return <StateBlock kind="denied" title="برای دیدن میزهای باز وارد شوید" action={<Button variant="primary" href="/login?next=/tables">ورود</Button>} />;

  const join = async (id: string) => {
    setJoining(id); setError(undefined);
    try { await api(`/tables/${id}/join`, { method: 'POST', body: {} }); navigate(`/tables/${id}`); }
    catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'پیوستن ممکن نشد.'); list.reload(); }
    finally { setJoining(undefined); }
  };

  return (
    <>
      <PageTabs group="tables" />
      <PageHead title="میزهای باز" sub="میزهای عمومی که منتظر بازیکن‌اند. روی میزی که جای خالی دارد بزنید تا بنشینید؛ میز خصوصی فقط با لینک دعوت باز می‌شود."
        actions={<>
          <Button href="/play" icon="zap">حریف‌یابی سریع</Button>
          <Button variant="primary" href="/games" icon="plus">میز بساز</Button>
        </>} />
      <div className="pg-head-actions">
        <Button icon="refresh-cw" onClick={() => { list.reload(); live.reload(); }}>به‌روزرسانی</Button>
      </div>
      {error && <div role="alert"><Banner tone="warning" text={error} /></div>}
      {list.loading && !list.data && <><Skeleton height={200} radius="var(--radius-lg)" /><span className="pg-sr" role="status">در حال بارگذاری میزها…</span></>}
      {list.error && <StateBlock kind="error" title="فهرست میزها دریافت نشد" text={list.error.messageFa} action={<Button onClick={list.reload}>تلاش دوباره</Button>} />}
      {list.data && (list.data.items.length === 0
        ? <StateBlock kind="empty" title="فعلاً میز بازی منتظر بازیکن نیست" action={<Button variant="primary" href="/games">یک بازی انتخاب کنید و میز بسازید</Button>} />
        : (
          <Card flush data-tour="open-tables" aria-label="میزهای باز">
            <div className="pg-colhead"><span>بازی</span><span>میزبان</span><span>صندلی‌ها</span><span /></div>
            <ul className="pg-ul">
              {list.data.items.map((t) => (
                <li key={t.id} className="pg-orow">
                  <div className="pg-orow__game">
                    <img className="pg-thumb" style={{ inlineSize: 72, blockSize: 40 }} src={`/covers/${t.gameId}.webp?v=2`} alt="" />
                    <div><b>{t.gameNameFa}</b><span className="pg-meta">{PACE_FA[t.pace]}<span className="bgv-sep" />{durationFa(t.turnSeconds)}</span></div>
                  </div>
                  <div className="pg-orow__host"><Identity size="sm" {...userIdentity(t.host)} sub="میزبان" /></div>
                  <div className="pg-orow__seats"><Badge icon="armchair">{faNum(t.players)} از {faNum(t.capacity)} نفر</Badge></div>
                  <Button variant="primary" icon="armchair" loading={joining === t.id} onClick={() => join(t.id)} aria-label={`پیوستن به میز ${t.gameNameFa}`}>پیوستن</Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      <section className="pg-sec" aria-labelledby="live-h">
        <h2 id="live-h" className="pg-h2">در حال بازی؛ تماشا کنید</h2>
        {live.error && <div role="alert"><Banner tone="warning" text={live.error.messageFa} /></div>}
        {live.data && (live.data.items.length === 0
          ? <p className="bgv-muted">فعلاً بازی عمومی یا تورنمنتی در جریان نیست.</p>
          : (
            <Card flush>
              <ul className="pg-ul">
                {live.data.items.map((t) => (
                  <li key={t.id} className="pg-ended">
                    <div className="pg-ended__main">
                      <b>{t.gameNameFa}</b>
                      <span className="pg-meta">{PACE_FA[t.pace]}
                        {t.tournament && <><span className="bgv-sep" /><a className="pg-link" href={`/tournaments/${t.tournament.id}`}>{t.tournament.titleFa}</a>، دور {faNum(t.tournament.round)}</>}
                        <span className="bgv-sep" />{t.players.map((n, i) => <span key={i}>{i > 0 && '، '}<bdi>{n}</bdi></span>)}
                      </span>
                    </div>
                    <Button size="sm" icon="eye" href={`/tables/${t.id}`}>تماشا</Button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
      </section>
    </>
  );
}
