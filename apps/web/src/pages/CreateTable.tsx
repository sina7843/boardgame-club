import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { GameDetail } from '@bg/contracts';
import { Banner, Breadcrumbs, Button, Card, PageHead, Segmented, Select, Skeleton, StateBlock, Switch } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { defaultTime, durationFa, faNum, PACE_FA, range } from '../lib/format.ts';
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
  const [turnSeconds, setTurnSeconds] = useState<number>(60);
  const [options, setOptions] = useState<Record<string, string | number | boolean>>({});
  const [reminders, setReminders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    if (!g) return;
    setPace(g.paces[0]!);
    setCapacity(g.minPlayers);
    setOptions(Object.fromEntries(g.options.map((o) => [o.key, o.default])));
  }, [g]);
  useEffect(() => { if (g) setTurnSeconds(defaultTime(pace === 'live' ? g.liveSeconds : g.turnSeconds, pace)); }, [pace, g]);

  const crumbs = (last: string) => <Breadcrumbs items={[{ label: 'بازی‌ها', href: '/games' }, ...(g ? [{ label: g.nameFa, href: `/games/${g.id}` }] : []), { label: last }]} />;
  if (status !== 'loading' && !me) {
    return <StateBlock kind="denied" title="برای ساخت میز وارد شوید" action={<Button variant="primary" href={`/login?next=/games/${id}/new`}>ورود</Button>} />;
  }
  if (loading && !g) return <><Skeleton height={320} radius="var(--radius-lg)" /><span className="pg-sr" role="status">در حال بارگذاری…</span></>;
  if (error || !g) return <StateBlock kind="error" title="اطلاعات بازی دریافت نشد" text={error?.messageFa} action={<Button onClick={reload}>تلاش دوباره</Button>} />;
  if (!g.acceptingNewTables) return <StateBlock kind="empty" title="ساخت میز تازه برای این بازی فعلاً ممکن نیست" action={<Button href={`/games/${g.id}`}>بازگشت</Button>} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setSubmitError(undefined);
    try {
      const { id: tableId } = await api<{ id: string }>('/tables', { method: 'POST', body: { gameId: g.id, pace, visibility, capacity, turnSeconds, reminders, competition: 'friendly', options } });
      navigate(`/tables/${tableId}`);
    } catch (err) {
      setSubmitError(err instanceof ApiFailure ? err.messageFa : 'ساخت میز انجام نشد.');
    } finally { setBusy(false); }
  };

  const counts = Array.from({ length: g.maxPlayers - g.minPlayers + 1 }, (_, i) => g.minPlayers + i);
  const timeLabel = pace === 'live' ? 'زمان هر حرکت' : 'مهلت هر نوبت';
  const fixed = (label: string, value?: string, note?: string) => <p className="pg-policy"><b>{label}: </b>{value}{note}</p>;

  return (
    <>
      {crumbs('میز تازه')}
      <PageHead title="میز تازه" sub={`${g.nameFa}؛ تنظیمات پس از شروع بازی تغییر نمی‌کنند.`} />
      <form className="bgv-cols" onSubmit={submit} noValidate data-tour="create-form">
        <div className="pg-stack">
          <Card title="سرعت و زمان">
            <div className="pg-stack">
              {g.paces.length > 1 ? (
                <div className="pg-field"><span className="bgv-label">حالت بازی</span>
                  <Segmented label="حالت بازی" value={pace} onChange={(v) => setPace(v as 'live' | 'turn')} options={g.paces.map((p) => ({ value: p, label: PACE_FA[p], icon: p === 'live' ? 'zap' : 'hourglass' }))} />
                </div>
              ) : fixed('حالت بازی', PACE_FA[pace])}
              <Select label={timeLabel} value={String(turnSeconds)} onChange={(e) => setTurnSeconds(Number(e.target.value))}
                options={(pace === 'live' ? g.liveSeconds : g.turnSeconds).map((s) => ({ value: String(s), label: durationFa(s) }))} />
              {pace === 'turn' && <Switch label="یادآوری پیش از پایان مهلت" checked={reminders} onChange={setReminders} />}
            </div>
          </Card>
          {(counts.length > 1 || g.options.length > 0) && (
            <Card title="بازیکنان و گزینه‌های قانون">
              <div className="pg-stack">
                {counts.length > 1 && (
                  <Select label="تعداد بازیکن" value={String(capacity)} onChange={(e) => setCapacity(Number(e.target.value))}
                    options={counts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />
                )}
                {g.options.map((o) => o.hostChooses && o.choices.length > 1 ? (
                  <div key={o.key} className="pg-field"><span className="bgv-label">{o.labelFa}</span>
                    <Segmented label={o.labelFa} value={String(o.choices.findIndex((c) => c.value === options[o.key]))}
                      onChange={(i) => setOptions({ ...options, [o.key]: o.choices[Number(i)]!.value })}
                      options={o.choices.map((c, i) => ({ value: String(i), label: c.labelFa }))} />
                  </div>
                ) : <div key={o.key}>{fixed(o.labelFa, o.choices.find((c) => c.value === o.default)?.labelFa, ' (تعیین‌شده برای این بازی)')}</div>)}
              </div>
            </Card>
          )}
          <Card title="نوع میز">
            <div className="pg-stack">
              <div className="pg-field"><span className="bgv-label">دسترسی</span>
                <Segmented label="دسترسی" value={visibility} onChange={(v) => setVisibility(v as 'private' | 'public')}
                  options={[{ value: 'private', label: 'خصوصی (با لینک دعوت)', icon: 'lock' }, { value: 'public', label: 'عمومی', icon: 'globe' }]} />
              </div>
              <p className="bgv-hint">نوع رقابت: دوستانه. میز رتبه‌دار پس از راه‌اندازی رتبه‌بندی فعال می‌شود. میز خصوصی فقط با لینک دعوت باز می‌شود و میز عمومی در «میزهای باز» دیده می‌شود.</p>
            </div>
          </Card>
          <Card title="قوانین زمان و انصراف">
            <p className="pg-policy"><b>اتمام زمان: </b>{g.timeoutPolicyFa}</p>
            <p className="pg-policy"><b>انصراف: </b>{g.resignPolicyFa}</p>
          </Card>
        </div>
        <aside className="pg-stack" aria-label="خلاصه میز">
          <Card flush>
            <div className="pg-sidecover"><img className="game-cover" src={`/covers/${g.id}.webp?v=2`} alt="" /></div>
            <div className="pg-stack" style={{ padding: 'var(--space-5)' }}>
              <div><h2 className="pg-h2">{g.nameFa}</h2>
                <span className="pg-meta">{range(g.minPlayers, g.maxPlayers, 'نفر')}<span className="bgv-sep" />{range(g.minMinutes, g.maxMinutes, 'دقیقه')}</span></div>
              <dl className="pg-sum">
                <div><dt>سرعت</dt><dd>{PACE_FA[pace]}</dd></div>
                <div><dt>{timeLabel}</dt><dd>{durationFa(turnSeconds)}</dd></div>
                <div><dt>بازیکنان</dt><dd>{faNum(capacity)} نفر</dd></div>
                <div><dt>رقابت</dt><dd>دوستانه</dd></div>
                <div><dt>دسترسی</dt><dd>{visibility === 'private' ? 'خصوصی' : 'عمومی'}</dd></div>
              </dl>
              {submitError && <div role="alert"><Banner tone="warning" text={submitError} /></div>}
              <Button type="submit" variant="primary" icon="plus" block loading={busy}>ساخت میز</Button>
              <Button block href={`/games/${g.id}`}>انصراف</Button>
              <p className="bgv-hint">تنظیمات پس از شروع بازی قفل می‌شوند.</p>
            </div>
          </Card>
        </aside>
      </form>
    </>
  );
}
