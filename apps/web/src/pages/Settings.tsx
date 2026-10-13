import { useState } from 'react';
import { Link } from 'react-router';
import { Segmented, Switch, buttonClass, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { browserNotificationsEnabled, setBrowserNotifications } from '../lib/realtime.tsx';
import type { UserSettings } from '@bg/contracts';
import { usePrefs } from '../lib/prefs.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { DeleteAccount } from '../shell/Account.tsx';

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
            options={[{ value: 'system', label: 'مطابق دستگاه' }, { value: 'light', label: 'روشن' }, { value: 'dark', label: 'تیره' }]} />
          <Segmented legend="حرکت و انیمیشن" name="motion" value={prefs.motion} onChange={(motion) => update({ motion })}
            options={[{ value: 'system', label: 'مطابق دستگاه' }, { value: 'reduce', label: 'کاهش‌یافته' }, { value: 'full', label: 'کامل' }]} />
          <Segmented legend="زمان انصراف حرکت" name="undo" value={prefs.undo} onChange={(undo) => update({ undo })}
            options={[{ value: 'off', label: 'خاموش' }, { value: '500', label: '۰٫۵ ثانیه' }, { value: '1000', label: '۱ ثانیه' }, { value: '2000', label: '۲ ثانیه' }]} />
          <p className="muted" style={{ margin: 0 }}>پس از هر حرکت مهم (بازی کردن کارت، جابه‌جایی مهره، خرید) تا این مدت می‌توانید «انصراف» بزنید. تاس، کشیدن کارت، پایان نوبت و «رد» همیشه بی‌درنگ فرستاده می‌شوند.</p>
          <Switch label="بی‌صدا" hint="صداهای بازی از مرحله بعدی توسعه پخش می‌شوند و این تنظیم را رعایت می‌کنند."
            checked={prefs.muted} onChange={(muted) => update({ muted })} />
        </section>

        <section className="panel row" aria-labelledby="profile-h" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 id="profile-h" className="section-title">پروفایل</h2>
            <p className="muted" style={{ margin: 0 }}>نام، آواتار، معرفی، لقب، بنر و ویترین جام‌ها در صفحهٔ پروفایل ویرایش می‌شوند.</p>
          </div>
          {status === 'loading' ? null : me ? <Link className={buttonClass('secondary', 'md')} to="/me/profile">ویرایش پروفایل</Link>
            : <Link className={buttonClass('secondary', 'md')} to="/login?next=/me/profile">ورود</Link>}
        </section>

        {me && <PrivacyForm />}
        {me && <DeleteAccount />}
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
