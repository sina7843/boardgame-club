import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { avatarKeys, displayNameSchema, normalizeIranMobile, toAsciiDigits, type Me } from '@bg/contracts';
import { Avatar, Button, Input } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';
import { AVATAR_FA, faNum, safeNext } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type Step = { kind: 'mobile' } | { kind: 'code'; challengeId: string; mobile: string; resendAt: number; fixture: boolean } | { kind: 'profile' };


export function Login() {
  usePageTitle('ورود');
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { me, refresh, setMe } = useSession();
  const [step, setStep] = useState<Step>({ kind: 'mobile' });
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<(typeof avatarKeys)[number]>('meeple');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (step.kind !== 'code') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step.kind]);

  if (me && step.kind !== 'profile') return <Navigate to={next} replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try { await fn(); } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'خطای غیرمنتظره رخ داد.'); } finally { setBusy(false); }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    const normalized = normalizeIranMobile(mobile);
    if (!normalized) { setError('شماره موبایل را به شکل ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.'); return; }
    void run(async () => {
      const r = await api<{ challengeId: string; resendAfterSeconds: number; fixtureDelivery: boolean }>('/auth/otp/request', { method: 'POST', body: { mobile: normalized } });
      setCode('');
      setStep({ kind: 'code', challengeId: r.challengeId, mobile: normalized, resendAt: Date.now() + r.resendAfterSeconds * 1000, fixture: r.fixtureDelivery });
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'code') return;
    void run(async () => {
      const r = await api<{ isNewUser: boolean }>('/auth/otp/verify', { method: 'POST', body: { challengeId: step.challengeId, code: toAsciiDigits(code.trim()) } });
      const m = await refresh();
      if (r.isNewUser || (m && !m.profileCompleted)) {
        setName(m?.displayName ?? '');
        setAvatar((m?.avatarKey as typeof avatar) ?? 'meeple');
        setStep({ kind: 'profile' });
      } else navigate(next, { replace: true });
    });
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    void run(async () => {
      setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { displayName: parsed.data, avatarKey: avatar } }));
      navigate(next, { replace: true });
    });
  };

  const wait = step.kind === 'code' ? Math.max(0, Math.ceil((step.resendAt - now) / 1000)) : 0;

  return (
    <div className="auth">
      <div className="panel auth__card">
        {step.kind === 'mobile' && (
          <form className="stack" onSubmit={sendCode} noValidate>
            <div>
              <h1 className="page-title">ورود یا ثبت‌نام</h1>
              <p className="page-sub">با شماره موبایل وارد شوید؛ اگر حساب ندارید، همین‌جا ساخته می‌شود.</p>
            </div>
            <Input label="شماره موبایل" name="mobile" inputMode="tel" autoComplete="tel" dir="ltr" className="input--ltr"
              placeholder="09121234567" value={mobile} onChange={(e) => setMobile(e.target.value)} error={error}
              hint="شماره شما در پروفایل عمومی نمایش داده نمی‌شود." autoFocus />
            <Button type="submit" busy={busy} block>دریافت کد</Button>
          </form>
        )}

        {step.kind === 'code' && (
          <form className="stack" onSubmit={verify} noValidate>
            <div>
              <h1 className="page-title">کد ورود</h1>
              <p className="page-sub">کد شش‌رقمی ارسال‌شده به <bdi dir="ltr">{step.mobile}</bdi> را وارد کنید.</p>
            </div>
            {step.fixture && (
              <div className="banner banner--info" role="note">
                حالت توسعه: پیامکی ارسال نشد. کد آزمایشی در پیکربندی محلی (OTP_FIXTURE_CODE) تعیین شده است.
              </div>
            )}
            <Input label="کد تأیید" name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" className="input--ltr"
              maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} error={error} autoFocus />
            <Button type="submit" busy={busy} block disabled={code.trim().length < 6}>ورود</Button>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setStep({ kind: 'mobile' }); setError(undefined); }}>تغییر شماره</Button>
              <Button type="button" variant="ghost" size="sm" disabled={wait > 0 || busy} onClick={() => sendCode()}>
                {wait > 0 ? `ارسال دوباره تا ${faNum(wait)} ثانیه دیگر` : 'ارسال دوباره کد'}
              </Button>
            </div>
          </form>
        )}

        {step.kind === 'profile' && (
          <form className="stack" onSubmit={saveProfile} noValidate>
            <div>
              <h1 className="page-title">خوش آمدید</h1>
              <p className="page-sub">نامی که دیگران سر میز می‌بینند و نماد خود را انتخاب کنید.</p>
            </div>
            <Input label="نام نمایشی" name="displayName" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} error={error}
              hint="۲ تا ۲۴ نویسه؛ نام نمایشی قابل گزارش است." autoFocus />
            <fieldset className="avatar-picker">
              <legend className="field__label">نماد</legend>
              {avatarKeys.map((k) => (
                <label key={k}>
                  <input type="radio" name="avatar" value={k} checked={avatar === k} onChange={() => setAvatar(k)} />
                  <Avatar avatarKey={k} name={AVATAR_FA[k] ?? k} size={44} />
                </label>
              ))}
            </fieldset>
            <Button type="submit" busy={busy} block>ذخیره و ادامه</Button>
          </form>
        )}
      </div>
    </div>
  );
}
