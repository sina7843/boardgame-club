import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { GameDetail, PublicProfile } from '@bg/contracts';
import { Banner, Breadcrumbs, Button, Checkbox, Icon, Identity, PageHead, Segmented, Select, Skeleton, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { BotPlay } from '../games/BotPlay.tsx';
import { userIdentity } from '../lib/bgv.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { defaultTime, DIFFICULTY_FA, durationFa, faNum, PACE_FA, range } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type Mode = 'link' | 'live' | 'ranked' | 'bot' | 'custom';

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
  const [mode, setMode] = useState<Mode>('custom');

  useEffect(() => {
    if (!g) return;
    // The game's first pace stays the default (many flows rely on it); its matching mode card is selected.
    setPace(g.paces[0]!);
    setMode(g.paces[0] === 'turn' ? 'link' : 'live');
    setCapacity(g.minPlayers);
    setOptions(Object.fromEntries(g.options.map((o) => [o.key, o.default])));
  }, [g]);
  useEffect(() => {
    if (!g) return;
    setTurnSeconds(defaultTime(pace === 'live' ? g.liveSeconds : g.turnSeconds, pace));
  }, [pace, g]);

  const crumbs = (last: string) => <Breadcrumbs items={[{ label: 'بازی‌ها', href: '/games' }, ...(g ? [{ label: g.nameFa, href: `/games/${g.id}` }] : []), { label: last }]} />;
  if (status !== 'loading' && !me) {
    return <StateBlock kind="denied" title="برای ساخت میز وارد شوید" action={<Button variant="primary" href={`/login?next=/games/${id}/new`}>ورود</Button>} />;
  }
  if (loading && !g) return <><Skeleton height={320} radius="var(--radius-lg)" /><span className="bgv-sr" role="status">در حال بارگذاری…</span></>;
  if (error || !g) return <StateBlock kind="error" title="اطلاعات بازی دریافت نشد" text={error?.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} />;
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
  // CreateTable-Desktop: four ready modes; any change under «تنظیمات بیشتر» makes it «سفارشی».
  const MODES = [
    ...(g.paces.includes('turn') ? [{ key: 'link' as const, icon: 'link', title: 'دوستانه با لینک', line: `نوبتی، ${durationFa(defaultTime(g.turnSeconds, 'turn'))} هر نوبت، خصوصی`, text: 'هر وقت خواستید حرکت کنید؛ فقط دعوت‌شده‌ها می‌آیند.' }] : []),
    ...(g.paces.includes('live') ? [{ key: 'live' as const, icon: 'zap', title: 'زنده با دوستان', line: `زنده، ${durationFa(defaultTime(g.liveSeconds, 'live'))} هر حرکت، خصوصی`, text: `همه همزمان پشت میز؛ حدود ${faNum(g.maxMinutes)} دقیقه.` }] : []),
    ...(g.competitions.includes('ranked') ? [{ key: 'ranked' as const, icon: 'trophy', title: 'رتبه‌ای عمومی', line: 'از «بازی سریع»، قانون رسمی', text: 'روی امتیاز مهارت شما اثر دارد؛ حریف را سرور پیدا می‌کند.' }] : []),
    ...(g.botAvailable ? [{ key: 'bot' as const, icon: 'bot', title: 'تمرین با ربات', line: 'بدون رتبه، هر وقت خواستید', text: 'بدون انتظار؛ برای یاد گرفتن قانون‌ها.' }] : [])
  ];
  const pick = (k: Mode) => {
    if (k === 'ranked') { navigate(`/play?game=${g.id}`); return; }
    setMode(k);
    if (k === 'link') { setPace('turn'); setVisibility('private'); }
    if (k === 'live') { setPace('live'); setVisibility('private'); setTurnSeconds(defaultTime(g.liveSeconds, 'live')); }
  };
  const custom = <T,>(set: (v: T) => void) => (v: T) => { set(v); if (mode !== 'bot') setMode('custom'); };
  const invited = (friends.data?.friends ?? []).filter((f) => invite.includes(f.id));
  const empty = Math.max(0, capacity - 1 - invited.length);
  const modeFa = mode === 'custom' ? 'سفارشی' : MODES.find((m) => m.key === mode)?.title ?? '';
  const ruleFa = g.options.filter((o) => o.hostChooses && o.choices.length > 1).map((o) => o.choices.find((c) => c.value === options[o.key])?.labelFa).filter(Boolean).join('، ');

  return (
    <>
      {crumbs('میز تازه')}
      <PageHead title={<span className="pg-newhead"><img src={`/covers/box/${g.id}.webp`} alt="" onError={(e) => { e.currentTarget.hidden = true; }} />میز تازه</span>}
        sub={<span className="pg-meta"><b>{g.nameFa}</b><span className="bgv-sep" />{range(g.minPlayers, g.maxPlayers, 'نفر')}<span className="bgv-sep" />{range(g.minMinutes, g.maxMinutes, 'دقیقه')}<span className="bgv-sep" />{DIFFICULTY_FA[g.difficulty]}</span>}
        actions={<Button variant="secondary" icon="refresh-cw" href="/games">تغییر بازی</Button>} />
      <form className="bgv-cols" onSubmit={submit} noValidate data-tour="create-form">
        <div className="pg-stack">
          <section className="bgv-card pg-step" aria-labelledby="step1-h">
            <div className="pg-step__head"><span className="pg-step__n">۱</span><div><h2 id="step1-h" className="pg-h2">چطور بازی کنیم؟</h2>
              <p className="pg-meta">یک حالت آماده انتخاب کنید؛ بعد اگر خواستید جزئیاتش را عوض کنید.</p></div></div>
            <div className="pg-modes" role="radiogroup" aria-label="نوع میز">
              {MODES.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} className={`pg-mode${mode === m.key ? ' is-on' : ''}`} onClick={() => pick(m.key)}>
                  <span className="pg-mode__ic"><Icon name={m.icon} /></span>
                  <span className="pg-mode__text"><b>{m.title}</b><span className="pg-mode__line">{m.line}</span><span className="pg-meta">{m.text}</span></span>
                  {mode === m.key && <Icon name="circle-check" className="pg-mode__tick" />}
                </button>
              ))}
            </div>
          </section>

          {mode === 'bot' ? (
            <section className="bgv-card pg-step" aria-labelledby="step2b-h">
              <div className="pg-step__head"><span className="pg-step__n">۲</span><h2 id="step2b-h" className="pg-h2">ربات</h2></div>
              <BotPlay gameId={g.id} minPlayers={g.minPlayers} maxPlayers={g.maxPlayers} />
            </section>
          ) : (
            <section className="bgv-card pg-step" aria-labelledby="step2-h">
              <div className="pg-step__head"><span className="pg-step__n">۲</span><div><h2 id="step2-h" className="pg-h2">بازیکنان</h2>
                <p className="pg-meta">{faNum(capacity)} صندلی؛ شما میزبان هستید.</p></div></div>
              <div className="pg-players">
                <div className="pg-stack">
                  <div className="bgv-row"><span className="bgv-label" style={{ flex: 1 }}>صندلی‌ها</span>
                    {counts.length > 1 && (counts.length <= 6
                      ? <Segmented label="تعداد بازیکن" value={String(capacity)} onChange={(v) => { setCapacity(Number(v)); setInvite(invite.slice(0, Number(v) - 1)); }} options={counts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />
                      : <Select aria-label="تعداد بازیکن" value={String(capacity)} onChange={(e) => setCapacity(Number(e.target.value))} options={counts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />)}</div>
                  <ul className="pg-seats">
                    {me && <li><Identity {...userIdentity(me, { size: 'md', you: true, sub: 'میزبان' })} /></li>}
                    {invited.map((f) => (
                      <li key={f.id}><Identity {...userIdentity(f, { size: 'md', sub: 'دعوت فرستاده می‌شود' })} />
                        <Button size="sm" variant="ghost" iconOnly icon="x" onClick={() => setInvite(invite.filter((x) => x !== f.id))}>{`برداشتن ${f.displayName}`}</Button></li>
                    ))}
                    {empty > 0 && <li className="pg-seats__empty"><span className="pg-meta"><Icon name="user-plus" size="sm" />{faNum(empty)} صندلی خالی، دعوت کنید</span></li>}
                  </ul>
                </div>
                <div className="pg-stack">
                  <span className="bgv-label">دعوت دوستان</span>
                  {(friends.data?.friends.length ?? 0) > 0 ? <>
                    <TextField icon="search" type="search" aria-label="جست‌وجوی دوستان" placeholder="جست‌وجوی دوستان" value={friendQ} onChange={(e) => setFriendQ(e.target.value)} />
                    <ul className="pg-invite">
                      {friends.data!.friends.filter((f) => !friendQ.trim() || f.displayName.includes(friendQ.trim())).slice(0, 8).map((f) => (
                        <li key={f.id}>
                          <Identity {...userIdentity(f, { size: 'sm' })} />
                          <Checkbox aria-label={`دعوت ${f.displayName}`} checked={invite.includes(f.id)} disabled={!invite.includes(f.id) && invite.length >= capacity - 1}
                            onChange={(e) => setInvite(e.target.checked ? [...invite, f.id] : invite.filter((x) => x !== f.id))} />
                        </li>
                      ))}
                    </ul>
                  </> : <p className="pg-meta">هنوز دوستی ندارید؛ لینک دعوت را در لابی می‌گیرید.</p>}
                  <p className="bgv-hint"><Icon name="link" size="sm" /> لینک دعوت بعد از ساخت میز در لابی آماده است.</p>
                </div>
              </div>
            </section>
          )}

          {mode !== 'bot' && (
            <details className="bgv-card pg-step pg-extra" open>
              <summary className="pg-step__head"><span className="pg-step__n">۳</span><div><h2 className="pg-h2">تنظیمات بیشتر</h2>
                <p className="pg-meta">{PACE_FA[pace]}، {clocked ? String(options.clock) : durationFa(turnSeconds)}، دوستانه، {visibility === 'private' ? 'خصوصی' : 'عمومی'}{ruleFa ? `، ${ruleFa}` : ''}؛ با تغییر هر گزینه حالت «سفارشی» می‌شود</p></div>
                <Icon name="chevron-down" className="pg-extra__chev" /></summary>
              <div className="pg-stack">
                {g.paces.length > 1 ? (
                  <div className="pg-field"><span className="bgv-label">حالت بازی</span>
                    <Segmented label="حالت بازی" value={pace} onChange={custom((v: string) => setPace(v as 'live' | 'turn'))} options={g.paces.map((p) => ({ value: p, label: PACE_FA[p], icon: p === 'live' ? 'zap' : 'hourglass' }))} />
                  </div>
                ) : fixed('حالت بازی', PACE_FA[pace])}
                {clocked ? <p className="bgv-hint">کنترل زمان «{String(options.clock)}»: هر بازیکن بانک زمان خودش را دارد.</p>
                  : <Select label={timeLabel} value={String(turnSeconds)} onChange={(e) => custom(setTurnSeconds)(Number(e.target.value))}
                    options={(pace === 'live' ? g.liveSeconds : g.turnSeconds).map((s) => ({ value: String(s), label: durationFa(s) }))} />}
                {pace === 'turn' && <Switch label="یادآوری پیش از پایان مهلت" checked={reminders} onChange={setReminders} />}
                {g.options.map((o) => o.hostChooses && o.choices.length > 1 ? (
                  <div key={o.key} className="pg-field"><span className="bgv-label">{o.labelFa}</span>
                    {o.choices.length <= 3 && o.choices.reduce((n, c) => n + c.labelFa.length, 0) <= 24
                      ? <Segmented label={o.labelFa} value={String(o.choices.findIndex((c) => c.value === options[o.key]))}
                        onChange={(i) => custom(setOptions)({ ...options, [o.key]: o.choices[Number(i)]!.value })}
                        options={o.choices.map((c, i) => ({ value: String(i), label: c.labelFa }))} />
                      : <Select aria-label={o.labelFa} value={String(o.choices.findIndex((c) => c.value === options[o.key]))}
                        onChange={(e) => custom(setOptions)({ ...options, [o.key]: o.choices[Number(e.target.value)]!.value })}
                        options={o.choices.map((c, i) => ({ value: String(i), label: c.labelFa }))} />}
                  </div>
                ) : <div key={o.key}>{fixed(o.labelFa, o.choices.find((c) => c.value === o.default)?.labelFa, ' (تعیین‌شده برای این بازی)')}</div>)}
                <div className="pg-field"><span className="bgv-label">دسترسی</span>
                  <Segmented label="دسترسی" value={visibility} onChange={custom((v: string) => setVisibility(v as 'private' | 'public'))}
                    options={[{ value: 'private', label: 'خصوصی (با لینک دعوت)', icon: 'lock' }, { value: 'public', label: 'عمومی', icon: 'globe' }]} />
                </div>
                <p className="bgv-hint">میز خصوصی فقط با لینک دعوت باز می‌شود و میز عمومی در «میزهای باز» دیده می‌شود. میز رتبه‌دار از «بازی سریع» ساخته می‌شود.</p>
                <p className="pg-policy"><b>اتمام زمان: </b>{g.timeoutPolicyFa}</p>
                <p className="pg-policy"><b>انصراف: </b>{g.resignPolicyFa}</p>
              </div>
            </details>
          )}
        </div>
        <aside className="pg-stack" aria-label="خلاصه میز">
          <section className="bgv-card pg-stack">
            <h2 className="pg-h2">خلاصهٔ میز</h2>
            <dl className="pg-sum">
              <div><dt>حالت</dt><dd>{modeFa}</dd></div>
              {mode !== 'bot' && <>
                <div><dt>سرعت</dt><dd>{PACE_FA[pace]}</dd></div>
                <div><dt>{clocked ? 'کنترل زمان' : pace === 'live' ? 'زمان' : 'مهلت'}</dt><dd>{clocked ? String(options.clock) : `${durationFa(turnSeconds)} هر ${pace === 'live' ? 'حرکت' : 'نوبت'}`}</dd></div>
                <div><dt>بازیکنان</dt><dd>{faNum(capacity)} نفر{empty ? `، ${faNum(empty)} صندلی خالی` : ''}</dd></div>
                <div><dt>رقابت</dt><dd>دوستانه</dd></div>
                <div><dt>دسترسی</dt><dd>{visibility === 'private' ? 'خصوصی' : 'عمومی'}</dd></div>
                {ruleFa && <div><dt>قانون</dt><dd>{ruleFa}</dd></div>}
                {pace === 'turn' && <div><dt>یادآوری</dt><dd>{reminders ? 'روشن' : 'خاموش'}</dd></div>}
                {invited.length > 0 && <div><dt>دعوت</dt><dd>{invited.map((f) => f.displayName).join('، ')}</dd></div>}
              </>}
            </dl>
            {submitError && <div role="alert"><Banner tone="warning" text={submitError} /></div>}
            {mode !== 'bot' && <Button type="submit" variant="primary" icon="plus" block loading={busy}>ساخت میز</Button>}
            <Button block href={`/games/${g.id}`}>انصراف</Button>
            <p className="bgv-hint"><Icon name="lock" size="sm" /> تنظیمات بعد از شروع بازی قفل می‌شوند.</p>
          </section>
        </aside>
        {mode !== 'bot' && (
          <div className="pg-createbar" role="group" aria-label="ساخت میز">
            <span className="pg-meta">{PACE_FA[pace]}<span className="bgv-sep" />{faNum(capacity)} نفر<span className="bgv-sep" />{clocked ? String(options.clock) : durationFa(turnSeconds)}</span>
            <Button type="submit" variant="primary" icon="plus" loading={busy}>ساخت میز</Button>
          </div>
        )}
      </form>
    </>
  );
}
