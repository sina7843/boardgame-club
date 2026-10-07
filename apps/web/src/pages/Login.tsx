import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Dices, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react';
import { avatarKeys, displayNameSchema, normalizeIranMobile, toAsciiDigits, type Me } from '@bg/contracts';
import { Avatar, Button, ErrorShake, Input, OtpField, cn, fa } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';
import { AVATAR_FA, safeNext } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type Step = { kind: 'mobile' } | { kind: 'code'; challengeId: string; mobile: string; resendAt: number; fixture: boolean } | { kind: 'profile' };
const STEPS = ['شماره', 'کد تأیید', 'پروفایل'] as const;

/** Three-step progress (VibeFarsi auth template): done steps are filled, the current one is ringed. */
function StepDots({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2" aria-label="مراحل ورود">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-(--motion) ease-motion',
            i < current ? 'bg-primary text-primary-foreground' : i === current ? 'bg-card text-primary shadow-control ring-2 ring-primary' : 'bg-secondary text-muted-foreground')}>
            {fa(i + 1)}
          </span>
          <span className={cn('whitespace-nowrap text-xs', i === current ? 'font-bold text-foreground' : 'text-muted-foreground')}>{s}</span>
          {i < STEPS.length - 1 && <span className={cn('h-0.5 w-6 rounded-full', i < current ? 'bg-primary' : 'bg-input')} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

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
  const phoneId = useId();

  useEffect(() => {
    if (step.kind !== 'code') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step.kind]);

  if (me && step.kind !== 'profile') return <Navigate to={next} replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try { await fn(); } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.'); } finally { setBusy(false); }
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

  const verify = (e?: FormEvent, value = code) => {
    e?.preventDefault();
    if (step.kind !== 'code' || value.length < 6 || busy) return;
    void run(async () => {
      const r = await api<{ isNewUser: boolean }>('/auth/otp/verify', { method: 'POST', body: { challengeId: step.challengeId, code: toAsciiDigits(value) } });
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
  const current = step.kind === 'mobile' ? 0 : step.kind === 'code' ? 1 : 2;

  return (
    <div className="grid min-h-[72dvh] place-items-center py-4">
      <div className="relative w-full max-w-md rounded-surface border-line border-border bg-card p-6 shadow-overlay sm:p-8 animate-fade-up">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-field bg-primary text-primary-foreground shadow-control animate-pop">
            <Dices className="size-7" strokeWidth={2} aria-hidden />
          </span>
          <StepDots current={current} />
        </div>

        {step.kind === 'mobile' && (
          <form className="grid gap-5" onSubmit={sendCode} noValidate key="mobile">
            <div className="text-center">
              <h1 className="text-2xl">ورود یا ثبت‌نام</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">با شماره موبایل وارد شوید؛ اگر حساب ندارید، همین‌جا ساخته می‌شود.</p>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={phoneId} className="text-sm font-medium text-foreground/90">شماره موبایل</label>
              <ErrorShake error={error ?? null} revertAfter={0}>
                <div dir="ltr" className="flex h-12 items-center gap-2 rounded-field border-line-field border-input bg-field px-4 shadow-field focus-within:border-transparent focus-within:ring-2 focus-within:ring-ring/60">
                  <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="shrink-0 text-sm text-muted-foreground">+98</span>
                  <input id={phoneId} name="mobile" inputMode="tel" autoComplete="tel" placeholder="912 345 6789" autoFocus
                    className="h-full w-full min-w-0 bg-transparent text-sm tracking-wide outline-none placeholder:text-muted-foreground/70"
                    aria-invalid={!!error || undefined} aria-describedby={`${phoneId}-hint`} value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </div>
              </ErrorShake>
              <span id={`${phoneId}-hint`} className="text-xs text-muted-foreground">شماره شما در پروفایل عمومی نمایش داده نمی‌شود.</span>
            </div>
            <Button type="submit" busy={busy} block size="lg">دریافت کد</Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden />کد یک‌بارمصرف با پیامک ارسال می‌شود.</p>
          </form>
        )}

        {step.kind === 'code' && (
          <form className="grid gap-5" onSubmit={(e) => verify(e)} noValidate key="code">
            <div className="text-center">
              <h1 className="text-2xl">کد ورود</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">کد شش‌رقمی ارسال‌شده به <bdi dir="ltr" className="font-semibold text-foreground">{fa(step.mobile)}</bdi> را وارد کنید.</p>
            </div>
            {step.fixture && (
              <div className="flex items-start gap-2 rounded-field bg-warning/10 px-4 py-3 text-xs leading-6 text-foreground ring-1 ring-warning/40" role="note">
                <MessageSquareText className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                حالت آزمایشی: پیامکی ارسال نشد. کد ورود آزمایشی را از مدیر سایت بگیرید.
              </div>
            )}
            <ErrorShake error={error ?? null} revertAfter={0} className="flex justify-center">
              <OtpField value={code} onChange={setCode} onComplete={(v) => verify(undefined, v)} disabled={busy} aria-label="کد تأیید" />
            </ErrorShake>
            <Button type="submit" busy={busy} block size="lg" disabled={code.length < 6}>ورود</Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => { setStep({ kind: 'mobile' }); setError(undefined); }}>
                <ArrowRight className="size-4" aria-hidden />تغییر شماره
              </button>
              {wait > 0
                ? <span className="text-muted-foreground" aria-live="polite">ارسال دوباره تا {fa(wait)} ثانیه دیگر</span>
                : <button type="button" disabled={busy} className="min-h-11 cursor-pointer font-semibold text-primary hover:underline" onClick={() => sendCode()}>ارسال دوباره کد</button>}
            </div>
          </form>
        )}

        {step.kind === 'profile' && (
          <form className="grid gap-5" onSubmit={saveProfile} noValidate key="profile">
            <div className="text-center">
              <h1 className="text-2xl">خوش آمدید</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">نامی که دیگران سر میز می‌بینند و نماد خود را انتخاب کنید.</p>
            </div>
            <Input label="نام نمایشی" name="displayName" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} error={error}
              hint="۲ تا ۲۴ نویسه؛ نام نمایشی قابل گزارش است." autoFocus />
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-2 text-sm font-medium text-foreground/90">نماد</legend>
              <div className="avatar-picker">
                {avatarKeys.map((k) => (
                  <label key={k}>
                    <input type="radio" name="avatar" value={k} checked={avatar === k} onChange={() => setAvatar(k)} />
                    <Avatar avatarKey={k} name={AVATAR_FA[k] ?? k} size={46} />
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" busy={busy} block size="lg">ذخیره و ادامه</Button>
          </form>
        )}
      </div>
    </div>
  );
}
