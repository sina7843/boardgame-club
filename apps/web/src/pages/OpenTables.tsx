import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar, Button, StateBlock } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { Hint } from '../shell/Onboarding.tsx';
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

  if (status !== 'loading' && !me) return <StateBlock kind="denied" title="برای دیدن میزهای باز وارد شوید" action={<Link className="btn btn--primary" to="/login?next=/tables">ورود</Link>} />;

  const join = async (id: string) => {
    setJoining(id); setError(undefined);
    try { await api(`/tables/${id}/join`, { method: 'POST', body: {} }); navigate(`/tables/${id}`); }
    catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'پیوستن ممکن نشد.'); list.reload(); }
    finally { setJoining(undefined); }
  };

  return (
    <>
      <PageTabs group="tables" />
      <div className="page-head">
        <div>
          <h1 className="page-title">میزهای باز<Hint id="open-tables">روی میزی که جای خالی دارد بزنید تا بنشینید؛ وقتی همه آماده شوند بازی شروع می‌شود. میزهای در حال بازی را هم می‌توانید تماشا کنید.</Hint></h1>
          <p className="page-sub">میزهای عمومی که منتظر بازیکن‌اند. میز خصوصی فقط با لینک دعوت باز می‌شود.</p>
        </div>
        <Button variant="secondary" onClick={() => { list.reload(); live.reload(); }}>به‌روزرسانی</Button>
      </div>
      {error && <div className="banner banner--warn" role="alert">{error}</div>}
      {list.loading && !list.data && <StateBlock kind="loading" title="در حال بارگذاری میزها…" />}
      {list.error && <StateBlock kind="error" title="فهرست میزها دریافت نشد" action={<Button onClick={list.reload}>تلاش دوباره</Button>}>{list.error.messageFa}</StateBlock>}
      {list.data && (list.data.items.length === 0
        ? <StateBlock kind="empty" title="فعلاً میز بازی منتظر بازیکن نیست" action={<Link className="btn btn--primary" to="/games">یک بازی انتخاب کنید و میز بسازید</Link>} />
        : (
          <ul className="list" data-tour="open-tables">
            {list.data.items.map((t) => (
              <li key={t.id} className="panel list__item">
                <Avatar avatarKey={t.host.avatarKey} name={t.host.displayName} />
                <div style={{ flex: 1, minInlineSize: 0 }}>
                  <strong>{t.gameNameFa}</strong>
                  <div className="muted">{PACE_FA[t.pace]} · {durationFa(t.turnSeconds)} · میزبان <bdi>{t.host.displayName}</bdi> · {faNum(t.players)} از {faNum(t.capacity)} نفر</div>
                </div>
                <Button busy={joining === t.id} onClick={() => join(t.id)}>پیوستن</Button>
              </li>
            ))}
          </ul>
        ))}
      <section className="stack" aria-labelledby="live-h" style={{ marginBlockStart: 'var(--space-6, 2rem)' }}>
        <h2 id="live-h" className="section-title">در حال بازی؛ تماشا کنید</h2>
        {live.error && <div className="banner banner--warn" role="alert">{live.error.messageFa}</div>}
        {live.data && (live.data.items.length === 0
          ? <p className="muted">فعلاً بازی عمومی یا تورنمنتی در جریان نیست.</p>
          : (
            <ul className="list">
              {live.data.items.map((t) => (
                <li key={t.id} className="panel list__item">
                  <div style={{ flex: 1, minInlineSize: 0 }}>
                    <strong>{t.gameNameFa}</strong>
                    {t.tournament && <> · <Link to={`/tournaments/${t.tournament.id}`}>{t.tournament.titleFa}</Link>، دور {faNum(t.tournament.round)}</>}
                    <div className="muted">{PACE_FA[t.pace]} · {t.players.map((n, i) => <span key={i}>{i > 0 && '، '}<bdi>{n}</bdi></span>)}</div>
                  </div>
                  <Link className="btn btn--secondary" to={`/tables/${t.id}`}>تماشا</Link>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </>
  );
}
