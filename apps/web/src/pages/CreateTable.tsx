import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { TIME_OPTIONS, type GameDetail } from '@bg/contracts';
import { Button, Segmented, Select, StateBlock, Switch } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

export function CreateTable() {
  const { id = '' } = useParams();
  const { me, status } = useSession();
  const navigate = useNavigate();
  const { data: g, error, loading, reload } = useApi<GameDetail>(`/games/${encodeURIComponent(id)}`);
  usePageTitle(g ? `میز تازه ${g.nameFa}` : 'میز تازه');
  const [pace, setPace] = useState<'live' | 'turn'>('live');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [capacity, setCapacity] = useState(2);
  const [turnSeconds, setTurnSeconds] = useState<number>(TIME_OPTIONS.live[2]);
  const [reminders, setReminders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    if (!g) return;
    setPace(g.paces[0]!);
    setCapacity(g.minPlayers);
  }, [g]);
  useEffect(() => { setTurnSeconds(pace === 'live' ? TIME_OPTIONS.live[2] : TIME_OPTIONS.turn[1]); }, [pace]);

  if (status !== 'loading' && !me) {
    return <StateBlock kind="denied" title="برای ساخت میز وارد شوید" action={<Link className="btn btn--primary" to={`/login?next=/games/${id}/new`}>ورود</Link>} />;
  }
  if (loading && !g) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  if (error || !g) return <StateBlock kind="error" title="اطلاعات بازی دریافت نشد" action={<Button onClick={reload}>تلاش دوباره</Button>}>{error?.messageFa}</StateBlock>;
  if (!g.acceptingNewTables) return <StateBlock kind="empty" title="ساخت میز تازه برای این بازی فعلاً ممکن نیست" action={<Link className="btn btn--secondary" to={`/games/${g.id}`}>بازگشت</Link>} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setSubmitError(undefined);
    try {
      const { id: tableId } = await api<{ id: string }>('/tables', { method: 'POST', body: { gameId: g.id, pace, visibility, capacity, turnSeconds, reminders, competition: 'friendly' } });
      navigate(`/tables/${tableId}`);
    } catch (err) {
      setSubmitError(err instanceof ApiFailure ? err.messageFa : 'ساخت میز انجام نشد.');
    } finally { setBusy(false); }
  };

  const counts = Array.from({ length: g.maxPlayers - g.minPlayers + 1 }, (_, i) => g.minPlayers + i);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">میز تازه: {g.nameFa}</h1>
          <p className="page-sub">تنظیمات پس از شروع بازی تغییر نمی‌کنند.</p>
        </div>
      </div>
      <form className="stack" style={{ maxInlineSize: 640 }} onSubmit={submit} noValidate>
        <section className="panel stack">
          <Segmented legend="حالت بازی" name="pace" value={pace} onChange={setPace} options={g.paces.map((p) => ({ value: p, label: PACE_FA[p] }))} />
          <Select label={pace === 'live' ? 'زمان هر حرکت' : 'مهلت هر نوبت'} value={String(turnSeconds)} onChange={(e) => setTurnSeconds(Number(e.target.value))}
            options={TIME_OPTIONS[pace].map((s) => ({ value: String(s), label: durationFa(s) }))} />
          {pace === 'turn' && <Switch label="یادآوری پیش از پایان مهلت" checked={reminders} onChange={setReminders} />}
          {counts.length > 1 && (
            <Select label="تعداد بازیکن" value={String(capacity)} onChange={(e) => setCapacity(Number(e.target.value))}
              options={counts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />
          )}
          <Segmented legend="دسترسی" name="visibility" value={visibility} onChange={setVisibility}
            options={[{ value: 'private', label: 'خصوصی (با لینک دعوت)' }, { value: 'public', label: 'عمومی' }]} />
          <p className="muted" style={{ margin: 0 }}>نوع رقابت: دوستانه. میز رتبه‌دار پس از راه‌اندازی رتبه‌بندی فعال می‌شود.</p>
        </section>
        <section className="panel stack" style={{ gap: 'var(--sp-2)' }}>
          <h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>قوانین زمان و انصراف</h2>
          <p className="policy"><strong>اتمام زمان: </strong>{g.timeoutPolicyFa}</p>
          <p className="policy"><strong>انصراف: </strong>{g.resignPolicyFa}</p>
        </section>
        {submitError && <div className="banner banner--warn" role="alert" style={{ margin: 0 }}>{submitError}</div>}
        <div className="row"><Button type="submit" busy={busy}>ساخت میز</Button><Link className="btn btn--ghost" to={`/games/${g.id}`}>انصراف</Link></div>
      </form>
    </>
  );
}
