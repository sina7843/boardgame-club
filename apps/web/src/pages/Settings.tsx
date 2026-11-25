import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { turnThresholds, VACATION_MAX_DAYS, type AlertPrefs, type UserSettings } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Badge, Button, Card, Clock, Dialog, Icon, Identity, PageHead, PageTabs, Segmented, Select, Slider, StateBlock, Switch, Tag, TextField } from '@bg/ui/bgv';
import { userIdentity } from '../lib/bgv.tsx';
import { faNum, jalaliDate, jalaliDateTime } from '../lib/format.ts';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { browserNotificationsEnabled, setBrowserNotifications } from '../lib/realtime.tsx';
import { playAlert } from '../lib/alerts.ts';
import { notifyFailFa } from '../lib/push.ts';
import { saveAlertPrefs, useAlertPrefs, usePrefs, type Prefs } from '../lib/prefs.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

const THEMES: { value: Prefs['theme']; label: string }[] = [{ value: 'system', label: 'مطابق دستگاه' }, { value: 'light', label: 'روشن' }, { value: 'dark', label: 'تیره' }];

function Section({ icon, title, extra, danger, children, id }: { icon: string; title: string; extra?: ReactNode; danger?: boolean; children: ReactNode; id: string }) {
  return (
    <Card className={`ac-sec${danger ? ' ac-danger' : ''}`} aria-labelledby={id}>
      <div className="ac-sec__head"><span className="ac-tile"><Icon name={icon} /></span><h2 id={id} className="ac-h3">{title}</h2>{extra}</div>
      {children}
    </Card>
  );
}

function Mini({ kind }: { kind: 'light' | 'dark' }) {
  return <span className="bgv" data-theme={kind}>
    <i className="ac-side" /><i className="ac-felt" />
    <i className="ac-bar" /><i className="ac-chip" />
  </span>;
}

function ThemePicker() {
  const { prefs, update } = usePrefs();
  return (
    <div className="ac-row ac-row--stack">
      <div className="ac-row__text"><b id="theme-l">پوسته</b></div>
      <div className="ac-theme-seg"><Segmented block label="پوسته" value={prefs.theme} onChange={(v) => update({ theme: v as Prefs['theme'] })} options={THEMES} /></div>
      <div role="radiogroup" aria-labelledby="theme-l" className="ac-theme-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {THEMES.map((t) => (
          <label key={t.value} className={`ac-theme${prefs.theme === t.value ? ' is-on' : ''}`}>
            <input type="radio" name="theme" className="bgv-sr" checked={prefs.theme === t.value} onChange={() => update({ theme: t.value })} />
            {t.value === 'system'
              ? <span className="ac-theme__art ac-theme__art--split"><Mini kind="light" /><Mini kind="dark" /></span>
              : <span className="ac-theme__art bgv" data-theme={t.value}><i className="ac-side" /><i className="ac-felt" /><i className="ac-bar" /><i className="ac-chip" /></span>}
            {t.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function Settings() {
  usePageTitle('تنظیمات');
  const { me, status, logout } = useSession();
  const { prefs, update } = usePrefs();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Deep link: /settings?tab=alerts (old ?tab=device and ?tab=account links land on the nearest tab).
  const raw = params.get('tab');
  const tab: TabKey = TABS.some(([k]) => k === raw) ? (raw as TabKey) : 'display';
  const device = deviceName();
  const display = (
    <div className="ac-sets">
      <div className="ac-stack" style={{ gap: 20 }}>
        <Section id="display-h" icon="palette" title="نمایش و دسترس‌پذیری" extra={<Tag>فقط همین دستگاه{device ? `، ${device}` : ''}</Tag>}>
          <ThemePicker />
          <div className="ac-row">
            <div className="ac-row__text"><b>حرکت و انیمیشن</b><span>پخش کارت، تاس و جشن‌ها</span></div>
            <Segmented label="حرکت و انیمیشن" value={prefs.motion} onChange={(motion) => update({ motion: motion as Prefs['motion'] })}
              options={[{ value: 'system', label: 'مطابق دستگاه' }, { value: 'reduce', label: 'کاهش‌یافته' }, { value: 'full', label: 'کامل' }]} />
          </div>
          <div className="ac-row ac-row--stack">
            <div className="ac-row__text"><b>زمان انصراف حرکت</b><span>پس از هر حرکت مهم (بازی کردن کارت، جابه‌جایی مهره، خرید) تا این مدت می‌توانید «انصراف» بزنید. تاس، کشیدن کارت، پایان نوبت و «رد» همیشه بی‌درنگ فرستاده می‌شوند.</span></div>
            <Segmented block label="زمان انصراف حرکت" value={prefs.undo} onChange={(undo) => update({ undo: undo as Prefs['undo'] })}
              options={[{ value: 'off', label: 'خاموش' }, { value: '500', label: '۰٫۵ ثانیه' }, { value: '1000', label: '۱ ثانیه' }, { value: '2000', label: '۲ ثانیه' }]} />
          </div>
        </Section>
      </div>
      {!me && (
        <div className="ac-stack" style={{ gap: 20 }}>
          <Section id="sound-h" icon="volume-2" title="صدا" extra={<Tag>فقط همین دستگاه</Tag>}>
            <div className="ac-row">
              <div className="ac-row__text"><b>بی‌صدا</b><span>همهٔ صداهای بازی روی این دستگاه.</span></div>
              <Switch aria-label="بی‌صدا" checked={prefs.muted} onChange={(muted) => update({ muted })} />
            </div>
          </Section>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHead title="تنظیمات" sub="تغییرها خودکار ذخیره می‌شوند؛ ظاهر و صدا روی همین دستگاه می‌مانند." />
      {me && <PageTabs label="بخش‌های تنظیمات" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} items={TABS.map(([value, label]) => ({ value, label }))} />}
      {(!me || tab === 'display') && display}
      {me && tab === 'alerts' && <div className="ac-sets"><div className="ac-stack" style={{ gap: 20 }}><PrivacyForm only="notify" /></div><div className="ac-stack" style={{ gap: 20 }}><TurnAlerts /></div></div>}
      {me && tab === 'privacy' && <div className="ac-sets"><div className="ac-stack" style={{ gap: 20 }}><PrivacyForm only="privacy" /></div></div>}
      {me && tab === 'profile' && (
        <div className="ac-sets"><div className="ac-stack" style={{ gap: 20 }}>
          <Section id="profile-h" icon="user" title="پروفایل">
            <div className="ac-row">
              <Identity size="lg" {...userIdentity(me, { sub: 'نام، آواتار، معرفی، لقب، بنر و ویترین جام‌ها' })} />
              <Button size="sm" icon="pencil" href="/me/profile">ویرایش پروفایل</Button>
            </div>
          </Section>
        </div></div>
      )}
      {me && tab === 'account' && (
        <div className="ac-sets"><div className="ac-stack" style={{ gap: 20 }}>
          <Section id="account-h" icon="user" title="حساب">
            <div className="ac-row">
              <div className="ac-row__text"><b>شمارهٔ موبایل</b><span>برای ورود؛ به هیچ بازیکنی نشان داده نمی‌شود.</span></div>
              <bdi dir="ltr" className="bgv-latin">{me.mobileMasked}</bdi>
            </div>
            <div className="ac-row">
              <div className="ac-row__text"><b>خروج از حساب</b><span>از همین دستگاه خارج می‌شوید؛ میزهای نوبتی شما ادامه دارند.</span></div>
              <Button size="sm" variant="leave" className="ac-signout" onClick={() => void logout().then(() => navigate('/'))}>خروج از حساب</Button>
            </div>
          </Section>
          {me.email?.available && <EmailCard />}
          <VacationCard />
          <DeleteAccountCard />
        </div></div>
      )}
      {!me && status !== 'loading' && (
        <Card><StateBlock kind="denied" title="برای تنظیمات حساب وارد شوید" action={<Button variant="primary" href="/login?next=/settings">ورود</Button>} /></Card>
      )}
    </>
  );
}

const TABS = [['display', 'نمایش و دسترس‌پذیری'], ['alerts', 'هشدار و اعلان'], ['privacy', 'حریم خصوصی'], ['profile', 'پروفایل'], ['account', 'حساب']] as const;
type TabKey = (typeof TABS)[number][0];

/** «کروم روی ویندوز»: browser and system from the user agent, for the device group title. */
function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'اج' : /Firefox\//.test(ua) ? 'فایرفاکس' : /Chrome\//.test(ua) ? 'کروم' : /Safari\//.test(ua) ? 'سافاری' : '';
  const os = /Android/.test(ua) ? 'اندروید' : /iPhone|iPad/.test(ua) ? 'آی‌او‌اس' : /Windows/.test(ua) ? 'ویندوز' : /Mac OS/.test(ua) ? 'مک' : /Linux/.test(ua) ? 'لینوکس' : '';
  return browser && os ? `${browser} روی ${os}` : browser || os;
}

const NOTIFY_FA: [keyof UserSettings['notify'], string][] = [['turn', 'نوبت و یادآوری مهلت'], ['invite', 'دعوت به میز و حریف‌یابی'], ['message', 'پیام خصوصی'], ['result', 'پایان بازی'], ['social', 'درخواست دوستی و باشگاه']];


function PrivacyForm({ only }: { only: 'privacy' | 'notify' }) {
  const s = useApi<UserSettings>('/me/settings');
  const toast = useToast();
  const [browser, setBrowser] = useState(browserNotificationsEnabled());
  if (s.error) return <Card><StateBlock kind="error" title="تنظیمات دریافت نشد" text={s.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={s.reload}>تلاش دوباره</Button>} /></Card>;
  if (!s.data) return <Card><StateBlock kind="loading" title="در حال بارگذاری…" /></Card>;
  const save = async (next: UserSettings) => {
    try { await api('/me/settings', { method: 'PUT', body: next }); s.reload(); toast('success', 'ذخیره شد.'); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره نشد.'); }
  };
  const d = s.data;
  return (
    <>
      {only === 'privacy' && <Section id="privacy-h" icon="lock" title="حریم خصوصی">
        <div className="ac-row">
          <div className="ac-row__text"><b>پیام خصوصی</b><span>چه کسی می‌تواند پیام خصوصی بفرستد</span></div>
          <Segmented label="چه کسی می‌تواند پیام خصوصی بفرستد" value={d.dmPolicy} onChange={(dmPolicy) => void save({ ...d, dmPolicy: dmPolicy as UserSettings['dmPolicy'] })}
            options={[{ value: 'friends', label: 'فقط دوستان' }, { value: 'nobody', label: 'هیچ‌کس' }]} />
        </div>
        <a className="ac-row ac-row--link" href="/friends?tab=blocked">
          <div className="ac-row__text"><b>مسدود و بی‌صدا</b><span>بازیکن‌هایی که مسدود یا بی‌صدا کرده‌اید</span></div>
          <Icon name="chevron-left" />
        </a>
      </Section>}
      {only === 'notify' && !browser && typeof Notification !== 'undefined' && Notification.permission !== 'denied' && (
        <Card className="ac-sec" aria-labelledby="perm-h">
          <div className="ac-row">
            <span className="ac-tile"><Icon name="bell-off" /></span>
            <div className="ac-row__text"><b id="perm-h">اعلان مرورگر هنوز اجازه ندارد</b><span>بدون آن، نوبت‌ها را فقط وقتی برگه باز است می‌بینید. مرورگر از شما می‌پرسد.</span></div>
            <Button variant="primary" icon="bell-ring" onClick={async () => { const ok = await setBrowserNotifications(true); setBrowser(ok); if (!ok) toast('error', notifyFailFa()); }}>اجازه‌ی اعلان</Button>
          </div>
        </Card>
      )}
      {only === 'notify' && <Section id="notify-h" icon="bell" title="اعلان‌ها">
        {NOTIFY_FA.map(([k, label]) => (
          <div key={k} className="ac-row"><div className="ac-row__text"><b>{label}</b></div>
            <Switch aria-label={label} checked={d.notify[k]} onChange={(v) => void save({ ...d, notify: { ...d.notify, [k]: v } })} /></div>
        ))}
        <div className="ac-row">
          <div className="ac-row__text"><b>اعلان مرورگر</b><span>وقتی برگه باز است ولی در پس‌زمینه است. اجازه مرورگر فقط با همین کلید درخواست می‌شود.</span></div>
          <Switch aria-label="اعلان مرورگر" checked={browser} onChange={async (v) => {
            const ok = await setBrowserNotifications(v);
            setBrowser(v && ok);
            if (v && !ok) toast('error', notifyFailFa());
          }} />
        </div>
        <p className="ac-cap ac-pad"><Icon name="info" size="sm" /> اعلان‌ها هیچ اطلاعات پنهان بازی یا متن پیام را نشان نمی‌دهند.</p>
      </Section>}
    </>
  );
}

const SOUNDS = [{ value: 'chime', label: 'زنگوله' }, { value: 'bell', label: 'ناقوس' }, { value: 'pulse', label: 'ضربان' }, { value: 'soft', label: 'ملایم' }];
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${h.toLocaleString('fa-IR').replace(/٬/g, ',')}:۰۰` }));

/** «هشدار نوبت»: account-wide sound, vibration and quiet hours (Tehran time). */
function TurnAlerts() {
  const a = useAlertPrefs();
  const toast = useToast();
  const save = async (next: AlertPrefs) => {
    try { await saveAlertPrefs(next); } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره نشد.'); }
  };
  const q = a.quietHours;
  const live = turnThresholds('live', 60), turn = turnThresholds('turn', 86400);
  return (
    <>
    <Section id="alerts-h" icon="volume-2" title="صدا و لرزش" extra={<Button size="sm" variant="secondary" icon="play" onClick={() => playAlert('critical', a)}>پخش نمونه</Button>}>
      <div className="ac-row">
        <div className="ac-row__text"><b>صداهای بازی</b><span>هشدار نوبت و لحظات پایانی؛ نیمهٔ مهلت فقط رنگ ساعت را عوض می‌کند.</span></div>
        <Switch aria-label="صداهای بازی" checked={a.sound} onChange={(sound) => void save({ ...a, sound })} />
      </div>
      <div className="ac-row">
        <div className="ac-row__text"><b>صدای «نوبت شماست»</b></div>
        <Switch aria-label="صدای نوبت شماست" checked={a.turnSound} disabled={!a.sound} onChange={(turnSound) => void save({ ...a, turnSound })} />
      </div>
      <div className="ac-row">
        <div className="ac-row__text"><b>هشدار ۱۰ ثانیهٔ آخر</b><span>بازی زنده: تیک کوتاه در هر ثانیه</span></div>
        <Switch aria-label="هشدار ۱۰ ثانیهٔ آخر" checked={a.criticalTick} disabled={!a.sound} onChange={(criticalTick) => void save({ ...a, criticalTick })} />
      </div>
      <div className="ac-row ac-row--stack">
        <div className="ac-row__text"><b>بلندی صدا</b></div>
        <Slider aria-label="بلندی صدا" min={0} max={100} step={5} value={a.volume} disabled={!a.sound}
          onChange={(e) => void save({ ...a, volume: Number(e.target.value) })} />
      </div>
      <div className="ac-row">
        <div className="ac-row__text"><b>لرزش</b><span>در دستگاه‌هایی که پشتیبانی می‌کنند</span></div>
        <Switch aria-label="لرزش" checked={a.vibration} onChange={(vibration) => void save({ ...a, vibration })} />
      </div>
      <div className="ac-row ac-row--stack">
        <Select label="صدای هشدار لحظات پایانی" value={a.criticalSound} options={SOUNDS} onChange={(e) => void save({ ...a, criticalSound: e.target.value as AlertPrefs['criticalSound'] })} />
      </div>
    </Section>
    <Section id="thresholds-h" icon="timer" title="آستانه‌های هشدار" extra={<Tag icon="lock">ثابت</Tag>}>
      <div className="ac-row">
        <div className="ac-row__text"><b>بازی زنده</b><span>نیمهٔ مهلت ساعت زرد می‌شود؛ در این مقدار پایانی قرمز.</span></div>
        <Clock size="chip" state="critical" p={0.1} time={live.criticalLeft} />
      </div>
      <div className="ac-row">
        <div className="ac-row__text"><b>بازی نوبتی</b><span>نیمهٔ مهلت ساعت زرد می‌شود؛ در این مقدار پایانی قرمز.</span></div>
        <Clock size="chip" state="critical" p={0.1} time={turn.criticalLeft} />
      </div>
    </Section>
    <Section id="quiet-h" icon="moon" title="ساعت سکوت">
      <div className="ac-row">
        <div className="ac-row__text"><b>ساعت سکوت</b><span>در این بازه صدا و لرزش نداریم (به وقت تهران)</span></div>
        <Switch aria-label="ساعت سکوت" checked={q.enabled} onChange={(enabled) => void save({ ...a, quietHours: { ...q, enabled } })} />
      </div>
      <div className="ac-row ac-row--stack">
        <Select label="از ساعت" value={String(q.startHour)} options={HOURS} disabled={!q.enabled} onChange={(e) => void save({ ...a, quietHours: { ...q, startHour: Number(e.target.value) } })} />
        <Select label="تا ساعت" value={String(q.endHour)} options={HOURS} disabled={!q.enabled} onChange={(e) => void save({ ...a, quietHours: { ...q, endHour: Number(e.target.value) } })} />
      </div>
    </Section>
    </>
  );
}

const VACATION_DAYS = Array.from({ length: VACATION_MAX_DAYS }, (_, i) => ({ value: String(i + 1), label: `${faNum(i + 1)} روز` }));

/** Vacation «مرخصی»: turn deadlines on turn-based, non-tournament tables wait until it ends (server enforced). */
function VacationCard() {
  const { me, refresh } = useSession();
  const toast = useToast();
  const [days, setDays] = useState('3');
  const [busy, setBusy] = useState(false);
  const v = me?.vacation;
  const send = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    try {
      await api('/me/vacation', method === 'POST' ? { method, body: { days: Number(days) } } : { method });
      await refresh();
      toast('success', method === 'POST' ? 'مرخصی شروع شد.' : 'مرخصی تمام شد.');
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
    finally { setBusy(false); }
  };
  return (
    <Section id="vacation-h" icon="sun" title="مرخصی" extra={v?.until ? <Badge tone="info" icon="sun">در مرخصی تا {jalaliDate(v.until)}</Badge> : undefined}>
      <div className="ac-sec__body">
        <p className="t-body-sm" style={{ margin: 0, textWrap: 'pretty' }}>در مرخصی، مهلت نوبت شما در میزهای نوبتی تمام نمی‌شود و یادآوری هم نمی‌گیرید؛ بعد از مرخصی یک نوبت کامل وقت دارید. میزهای زنده و تورنمنت‌ها شامل مرخصی نمی‌شوند. مرخصی دست‌کم ۱ و حداکثر ۷ روز است و بین دو مرخصی باید ۷ روز فاصله باشد.</p>
        {v?.until ? (
          <div><Button variant="secondary" loading={busy} onClick={() => void send('DELETE')}>پایان زودتر مرخصی</Button></div>
        ) : v?.availableAt ? (
          <StateBlock kind="empty" title="فعلاً نمی‌توانید مرخصی بگیرید" text={`مرخصی بعدی از ${jalaliDateTime(v.availableAt)} ممکن است.`} />
        ) : (
          <div className="ac-row">
            <Select label="مدت مرخصی" value={days} options={VACATION_DAYS} onChange={(e) => setDays(e.target.value)} />
            <Button variant="primary" loading={busy} onClick={() => void send('POST')}>شروع مرخصی</Button>
          </div>
        )}
      </div>
    </Section>
  );
}

/** Email: add (6-digit code by email) → verify → remove; daily turn digest and tournament reminder on/off. Shown only when SMTP is configured. */
function EmailCard() {
  const { me, refresh } = useSession();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const e = me?.email;
  const run = async (path: string, init: Parameters<typeof api>[1], done: string) => {
    setBusy(true);
    try {
      await api(path, init);
      await refresh();
      setCode('');
      toast('success', done);
    } catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'انجام نشد.'); }
    finally { setBusy(false); }
  };
  const sendCode = (to: string) => run('/me/email', { method: 'POST', body: { email: to.trim() } }, 'کد تأیید به ایمیل شما فرستاده شد.');
  if (!e) return null;
  return (
    <Section id="email-h" icon="send" title="ایمیل" extra={e.address ? <Badge tone="success" icon="check">تأییدشده</Badge> : undefined}>
      <div className="ac-sec__body">
        <p className="t-body-sm" style={{ margin: 0, textWrap: 'pretty' }}>هر روز ساعت ۹ صبح، اگر در میزهای نوبتی نوبت شما باشد، یک ایمیل خلاصه می‌گیرید؛ یک ساعت پیش از شروع تورنمنت‌هایی که ثبت‌نام کرده‌اید هم یادآوری می‌آید. ایمیل شما به هیچ بازیکنی نشان داده نمی‌شود.</p>
        {e.pending ? (
          <form className="ac-row" onSubmit={(ev) => { ev.preventDefault(); void run('/me/email/verify', { method: 'POST', body: { code } }, 'ایمیل شما تأیید شد.'); }}>
            <TextField label="کد ۶ رقمی" hint={<>فرستاده‌شده به <bdi dir="ltr">{e.pending}</bdi></>} value={code} onChange={(ev) => setCode(ev.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" dir="ltr" />
            <Button type="submit" variant="primary" loading={busy} disabled={code.length !== 6}>تأیید</Button>
            <Button variant="ghost" disabled={busy} onClick={() => void sendCode(e.pending!)}>ارسال دوباره</Button>
            {!e.address && <Button variant="ghost" disabled={busy} onClick={() => void run('/me/email', { method: 'DELETE' }, 'می‌توانید نشانی دیگری وارد کنید.')}>تغییر ایمیل</Button>}
          </form>
        ) : e.address ? (
          <>
            <div className="ac-row">
              <div className="ac-row__text"><b>نشانی ایمیل</b><bdi dir="ltr" className="bgv-latin">{e.address}</bdi></div>
              <Button size="sm" variant="secondary" loading={busy} onClick={() => void run('/me/email', { method: 'DELETE' }, 'ایمیل حذف شد.')}>حذف ایمیل</Button>
            </div>
            <div className="ac-row">
              <div className="ac-row__text"><b>ایمیل‌های یادآوری</b><span>خلاصهٔ روزانهٔ نوبت‌ها و یادآوری تورنمنت</span></div>
              <Switch aria-label="ایمیل‌های یادآوری" checked={e.digest} disabled={busy} onChange={(digest) => void run('/me/email/digest', { method: 'PUT', body: { digest } }, digest ? 'ایمیل‌های یادآوری روشن شد.' : 'ایمیل‌های یادآوری خاموش شد.')} />
            </div>
          </>
        ) : (
          <form className="ac-row" onSubmit={(ev) => { ev.preventDefault(); void sendCode(email); }}>
            <TextField label="نشانی ایمیل" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} autoComplete="email" dir="ltr" />
            <Button type="submit" variant="primary" loading={busy} disabled={!email.includes('@')}>ارسال کد</Button>
          </form>
        )}
      </div>
    </Section>
  );
}

/** Permanent self-service account deletion, confirmed by typing «حذف». */
function DeleteAccountCard() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE', body: { confirm: 'حذف' } });
      setOpen(false);
      await refresh();
      toast('success', 'حساب شما حذف شد.');
      void navigate('/');
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
    finally { setBusy(false); }
  };
  return (
    <Section id="delete-h" icon="trash-2" title="حذف حساب کاربری" danger>
      <div className="ac-sec__body">
        <p className="t-body-sm" style={{ margin: 0, textWrap: 'pretty' }}>نام، نماد، پروفایل، دوستان و شماره موبایل شما حذف می‌شود و از همهٔ دستگاه‌ها خارج می‌شوید. سوابق بازی‌ها و پیام‌های قبلی با نام «کاربر حذف‌شده» باقی می‌ماند. سکه، اشتراک و دستاوردها از بین می‌روند و این کار برگشت‌پذیر نیست.</p>
        <div><Button variant="danger" onClick={() => { setTyped(''); setOpen(true); }}>حذف حساب</Button></div>
      </div>
      {open && (
        <Dialog modal danger icon="trash-2" title="حذف همیشگی حساب" onClose={() => setOpen(false)}
          footer={<><Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
            <Button variant="danger" loading={busy} disabled={typed.trim() !== 'حذف'} onClick={() => void remove()}>حذف همیشگی</Button></>}>
          <div className="ac-stack">
            <p style={{ margin: 0 }}>این کار برگشت‌پذیر نیست. اگر بعداً با همین شماره وارد شوید، یک حساب تازه و خالی ساخته می‌شود.</p>
            <TextField label="برای تأیید، کلمهٔ «حذف» را بنویسید" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </div>
        </Dialog>
      )}
    </Section>
  );
}
