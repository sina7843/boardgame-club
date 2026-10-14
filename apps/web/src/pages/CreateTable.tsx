import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { GameDetail, PublicProfile } from '@bg/contracts';
import { Avatar, Banner, Breadcrumbs, Button, Card, Checkbox, Identity, PageHead, Segmented, Select, Skeleton, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { userIdentity } from '../lib/bgv.tsx';
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
  const friends = useApi<{ friends: PublicProfile[] }>(me ? '/me/friends' : null);
  const [invite, setInvite] = useState<string[]>([]);
  const [friendQ, setFriendQ] = useState('');

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
      // Friends picked here get a table invitation right away; a failed invite never blocks the new table.
      await Promise.all(invite.map((userId) => api(`/tables/${tableId}/invites`, { method: 'POST', body: { userId } }).catch(() => undefined)));
      navigate(`/tables/${tableId}`);
    } catch (err) {
      setSubmitError(err instanceof ApiFailure ? err.messageFa : 'ساخت میز انجام نشد.');
    } finally { setBusy(false); }
  };

  const counts = Array.from({ length: g.maxPlayers - g.minPlayers + 1 }, (_, i) => g.minPlayers + i);
  const timeLabel = pace === 'live' ? 'زمان هر حرکت' : 'مهلت هر نوبت';
  const clocked = pace === 'live' && typeof options.clock === 'string' && options.clock !== 'none';
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
              {clocked ? <p className="bgv-hint">کنترل زمان «{String(options.clock)}»: هر بازیکن بانک زمان خودش را دارد (در «گزینه‌های قانون» عوض می‌شود).</p>
                : <Select label={timeLabel} value={String(turnSeconds)} onChange={(e) => setTurnSeconds(Number(e.target.value))}
                  options={(pace === 'live' ? g.liveSeconds : g.turnSeconds).map((s) => ({ value: String(s), label: durationFa(s) }))} />}
              {pace === 'turn' && <Switch label="یادآوری پیش از پایان مهلت" checked={reminders} onChange={setReminders} />}
            </div>
          </Card>
          {(counts.length > 1 || g.options.length > 0) && (
            <Card title="بازیکنان و گزینه‌های قانون">
              <div className="pg-stack">
                {counts.length > 1 && (
                  <div className="pg-field"><span className="bgv-label">تعداد بازیکن</span>
                    {counts.length <= 6
                      ? <Segmented label="تعداد بازیکن" value={String(capacity)} onChange={(v) => setCapacity(Number(v))} options={counts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />
                      : <Select aria-label="تعداد بازیکن" value={String(capacity)} onChange={(e) => setCapacity(Number(e.target.value))} options={counts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />}
                    <span className="bgv-avatars pg-seatprev" aria-hidden="true">
                      {Array.from({ length: capacity }, (_, i) => <Avatar key={i} size="sm" className={`seat-${i + 1}`} initials={i === 0 ? 'شما' : ''} {...(i === 0 ? { you: true } : {})} />)}
                    </span>
                  </div>
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
          {(friends.data?.friends.length ?? 0) > 0 && (
            <Card title={`دعوت دوستان${invite.length ? ` (${faNum(invite.length)})` : ''}`}>
              <div className="pg-stack">
                <TextField icon="search" type="search" label="جست‌وجوی دوستان" value={friendQ} onChange={(e) => setFriendQ(e.target.value)} />
                <ul className="pg-invite">
                  {friends.data!.friends.filter((f) => !friendQ.trim() || f.displayName.includes(friendQ.trim())).slice(0, 8).map((f) => (
                    <li key={f.id}>
                      <Identity {...userIdentity(f, { size: 'sm' })} />
                      <Checkbox aria-label={`دعوت ${f.displayName}`} checked={invite.includes(f.id)} disabled={!invite.includes(f.id) && invite.length >= capacity - 1}
                        onChange={(e) => setInvite(e.target.checked ? [...invite, f.id] : invite.filter((x) => x !== f.id))} />
                    </li>
                  ))}
                </ul>
                <p className="bgv-hint">دعوت پس از ساخت میز فرستاده می‌شود؛ در لابی هم لینک دعوت را دارید.</p>
              </div>
            </Card>
          )}
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
                <div><dt>{clocked ? 'کنترل زمان' : timeLabel}</dt><dd>{clocked ? String(options.clock) : durationFa(turnSeconds)}</dd></div>
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
        <div className="pg-createbar" role="group" aria-label="ساخت میز">
          <span className="pg-meta">{PACE_FA[pace]}<span className="bgv-sep" />{faNum(capacity)} نفر<span className="bgv-sep" />{clocked ? String(options.clock) : durationFa(turnSeconds)}</span>
          <Button type="submit" variant="primary" icon="plus" loading={busy}>ساخت میز</Button>
        </div>
      </form>
    </>
  );
}
