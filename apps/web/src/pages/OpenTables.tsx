import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar, Button, StateBlock } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

interface OpenTable { id: string; gameId: string; gameNameFa: string; pace: 'live' | 'turn'; players: number; capacity: number; turnSeconds: number; host: { displayName: string; avatarKey: string } }

export function OpenTables() {
  usePageTitle('میزهای باز');
  const { me, status } = useSession();
  const navigate = useNavigate();
  const list = useApi<{ items: OpenTable[] }>(me ? '/tables' : null);
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
      <div className="page-head">
        <div>
          <h1 className="page-title">میزهای باز</h1>
          <p className="page-sub">میزهای عمومی که منتظر بازیکن‌اند. میز خصوصی فقط با لینک دعوت باز می‌شود.</p>
        </div>
        <Button variant="secondary" onClick={list.reload}>به‌روزرسانی</Button>
      </div>
      {error && <div className="banner banner--warn" role="alert">{error}</div>}
      {list.loading && !list.data && <StateBlock kind="loading" title="در حال بارگذاری میزها…" />}
      {list.error && <StateBlock kind="error" title="فهرست میزها دریافت نشد" action={<Button onClick={list.reload}>تلاش دوباره</Button>}>{list.error.messageFa}</StateBlock>}
      {list.data && (list.data.items.length === 0
        ? <StateBlock kind="empty" title="فعلاً میز بازی منتظر بازیکن نیست" action={<Link className="btn btn--primary" to="/games">یک بازی انتخاب کنید و میز بسازید</Link>} />
        : (
          <ul className="list">
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
    </>
  );
}
