import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { avatarKeys, displayNameSchema, type Me } from '@bg/contracts';
import { Avatar, Button, Input, Segmented, Switch, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { browserNotificationsEnabled, setBrowserNotifications } from '../lib/realtime.tsx';
import type { UserSettings } from '@bg/contracts';
import { AVATAR_FA, jalaliDate } from '../lib/format.ts';
import { usePrefs } from '../lib/prefs.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

function ProfileForm({ me }: { me: Me }) {
  const { setMe } = useSession();
  const toast = useToast();
  const [name, setName] = useState(me.displayName);
  const [avatar, setAvatar] = useState(me.avatarKey);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(me.displayName); setAvatar(me.avatarKey); }, [me]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    setBusy(true); setError(undefined);
    try {
      setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { displayName: parsed.data, avatarKey: avatar } }));
      toast('success', 'پروفایل ذخیره شد.');
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messageFa : 'ذخیره انجام نشد.');
    } finally { setBusy(false); }
  };

  return (
    <form className="stack" onSubmit={save} noValidate>
      <Input label="نام نمایشی" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} error={error} hint="۲ تا ۲۴ نویسه" />
      <fieldset className="avatar-picker">
        <legend className="field__label">نماد</legend>
        {avatarKeys.map((k) => (
          <label key={k}>
            <input type="radio" name="avatar" value={k} checked={avatar === k} onChange={() => setAvatar(k)} />
            <Avatar avatarKey={k} name={AVATAR_FA[k] ?? k} size={44} />
          </label>
        ))}
      </fieldset>
      <dl className="facts">
        <div><dt>شماره موبایل (فقط برای شما)</dt><dd><bdi dir="ltr">{me.mobileMasked}</bdi></dd></div>
        <div><dt>عضویت از</dt><dd>{jalaliDate(me.joinedAt)}</dd></div>
      </dl>
      <div><Button type="submit" busy={busy}>ذخیره پروفایل</Button></div>
    </form>
  );
}

export function Settings() {
  usePageTitle('تنظیمات');
  const { me, status } = useSession();
  const { prefs, update } = usePrefs();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">تنظیمات</h1>
          <p className="page-sub">ظاهر و صدا روی همین دستگاه ذخیره می‌شوند.</p>
        </div>
      </div>

      <div className="stack" style={{ maxInlineSize: 720 }}>
        <section className="panel stack" aria-labelledby="display-h">
          <h2 id="display-h" className="section-title">نمایش و دسترس‌پذیری</h2>
          <Segmented legend="پوسته" name="theme" value={prefs.theme} onChange={(theme) => update({ theme })}
            options={[{ value: 'dark', label: 'تیره' }, { value: 'light', label: 'روشن' }, { value: 'system', label: 'مطابق دستگاه' }]} />
          <Segmented legend="حرکت و انیمیشن" name="motion" value={prefs.motion} onChange={(motion) => update({ motion })}
            options={[{ value: 'system', label: 'مطابق دستگاه' }, { value: 'reduce', label: 'کاهش‌یافته' }, { value: 'full', label: 'کامل' }]} />
          <Switch label="بی‌صدا" hint="صداهای بازی از مرحله بعدی توسعه پخش می‌شوند و این تنظیم را رعایت می‌کنند."
            checked={prefs.muted} onChange={(muted) => update({ muted })} />
        </section>

        <section className="panel stack" aria-labelledby="profile-h">
          <h2 id="profile-h" className="section-title">پروفایل</h2>
          {status === 'loading' ? <p className="muted" role="status">در حال بارگذاری…</p>
            : me ? <ProfileForm me={me} />
            : <p className="muted" style={{ margin: 0 }}>برای ویرایش نام نمایشی و نماد <Link to="/login?next=/settings">وارد شوید</Link>.</p>}
        </section>

        {me && <PrivacyForm />}
        <p className="muted"><Link to="/design">نمایش اجزای طراحی</Link></p>
      </div>
    </>
  );
}

const NOTIFY_FA: [keyof UserSettings['notify'], string][] = [['turn', 'نوبت و یادآوری مهلت'], ['invite', 'دعوت به میز و حریف‌یابی'], ['message', 'پیام خصوصی'], ['result', 'پایان بازی'], ['social', 'درخواست دوستی و باشگاه']];

function PrivacyForm() {
  const s = useApi<UserSettings>('/me/settings');
  const toast = useToast();
  const [browser, setBrowser] = useState(browserNotificationsEnabled());
  if (s.error) return <p className="field__error">{s.error.messageFa}</p>;
  if (!s.data) return <p className="muted" role="status">در حال بارگذاری…</p>;
  const save = async (next: UserSettings) => {
    try { await api('/me/settings', { method: 'PUT', body: next }); s.reload(); toast('success', 'ذخیره شد.'); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره نشد.'); }
  };
  const d = s.data;
  return (
    <section className="panel stack" aria-labelledby="privacy-h">
      <h2 id="privacy-h" className="section-title">حریم خصوصی و اعلان‌ها</h2>
      <Segmented legend="چه کسی می‌تواند پیام خصوصی بفرستد" name="dm" value={d.dmPolicy} onChange={(dmPolicy) => save({ ...d, dmPolicy })}
        options={[{ value: 'friends', label: 'فقط دوستان' }, { value: 'nobody', label: 'هیچ‌کس' }]} />
      {NOTIFY_FA.map(([k, label]) => (
        <Switch key={k} label={label} checked={d.notify[k]} onChange={(v) => save({ ...d, notify: { ...d.notify, [k]: v } })} />
      ))}
      <Switch label="اعلان مرورگر" hint="وقتی برگه باز است ولی در پس‌زمینه است. اجازه مرورگر فقط با همین کلید درخواست می‌شود."
        checked={browser} onChange={async (v) => {
          const ok = await setBrowserNotifications(v);
          setBrowser(v && ok);
          if (v && !ok) toast('error', 'مرورگر اجازه اعلان نداد یا پشتیبانی نمی‌کند.');
        }} />
      <p className="muted" style={{ margin: 0 }}>اعلان‌ها هیچ اطلاعات پنهان بازی یا متن پیام را نشان نمی‌دهند.</p>
    </section>
  );
}
