import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { avatarKeys, displayNameSchema, normalizeIranMobile, toAsciiDigits, type Me } from '@bg/contracts';
import { fa } from '@bg/ui';
import { Banner, Button, Card, FeltPlate, Icon, Logo, OtpField, PhoneField, Seat, TextField, TurnPill } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { AVATAR_FA, faNum, safeNext } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { stashGift } from '../shell/WelcomeGift.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { SITE_LINKS } from './SitePage.tsx';

type Step = { kind: 'mobile' } | { kind: 'code'; challengeId: string; mobile: string; resendAt: number; fixture: boolean } | { kind: 'profile' };
const STEPS = ['شماره', 'کد تأیید', 'پروفایل'] as const;
const FAN = ['terraforming-mars', 'catan', 'azul', 'hanabi'] as const;
const FAN_POS = [[-0.83, 15, -10], [-0.28, 5, -3.3], [0.28, 5, 3.3], [0.83, 15, 10]] as const;

/** Three-step progress: done steps carry a check, the current one is ringed. */
function StepDots({ current }: { current: number }) {
  return (
    <ol className="ac-steps" aria-label="مراحل ورود">
      {STEPS.flatMap((s, i) => [
        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-cur' : undefined} aria-current={i === current ? 'step' : undefined}>
          <b>{i < current ? <Icon name="check" size="sm" /> : fa(i + 1)}</b>{s}
        </li>,
        ...(i < STEPS.length - 1 ? [<li key={`${s}-bar`} className={`ac-bar${i < current ? ' is-done' : ''}`} aria-hidden />] : [])
      ])}
    </ol>
  );
}

/** Avatar glyphs: the meeple is the brand's game piece, the rest are DS icons. */
const AVATAR_ART: Record<string, { tone: string; node: ReactNode }> = {
  meeple: { tone: 'success', node: <svg className="ac-meeple" viewBox="0 0 24 24" aria-hidden><path d="M12 2.5a3.2 3.2 0 0 1 3.2 3.2c0 .9-.3 1.6-.8 2.2 3 .4 7.1 1.7 7.1 3.7 0 1.3-1.7 1.7-3.7 1.5l2.1 6.4c.2.6-.2 1.1-.8 1.1h-4.1L12 16.2l-3 4.4H4.9c-.6 0-1-.5-.8-1.1l2.1-6.4c-2 .2-3.7-.2-3.7-1.5 0-2 4.1-3.3 7.1-3.7-.5-.6-.8-1.3-.8-2.2A3.2 3.2 0 0 1 12 2.5z" /></svg> },
  dice: { tone: 'info', node: <Icon name="dices" size={30} /> },
  crown: { tone: 'warning', node: <Icon name="crown" size={30} /> },
  pawn: { tone: 'invite', node: <Icon name="user" size={30} /> },
  card: { tone: 'raised', node: <Icon name="layers" size={30} /> },
  star: { tone: 'danger', node: <Icon name="star" size={30} /> }
};

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
  const games = useApi<{ items: unknown[] }>('/games');

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
      let referralCode: string | undefined;
      try { referralCode = params.get('ref') ?? localStorage.getItem('bg_ref') ?? undefined; } catch { /* storage blocked */ }
      const r = await api<{ isNewUser: boolean; welcomeGiftDays: number }>('/auth/otp/verify', { method: 'POST', body: { challengeId: step.challengeId, code: toAsciiDigits(value), referralCode } });
      try { localStorage.removeItem('bg_ref'); } catch { /* storage blocked */ }
      if (r.welcomeGiftDays > 0) stashGift(r.welcomeGiftDays); // opened once the player leaves the login page
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
  const count = games.data?.items.length;

  return (
    <div className="bgv ac-login">
      <section className="ac-login__form">
        <span className="bgv-spacer" />
        <Card className="ac-login__card">
          <StepDots current={current} />

          {step.kind === 'mobile' && (
            <form className="ac-stack" style={{ gap: 14 }} onSubmit={sendCode} noValidate key="mobile">
              <div className="ac-login__head">
                <h1 className="t-page">ورود یا ثبت‌نام</h1>
                <p className="t-body-sm bgv-muted">با شماره موبایل وارد شوید؛ اگر حساب ندارید، همین‌جا ساخته می‌شود.</p>
              </div>
              <PhoneField label="شماره موبایل" name="mobile" placeholder="912 345 6789" autoFocus autoComplete="tel" value={mobile}
                onChange={(e) => setMobile(e.target.value)} error={error} hint="شماره شما در پروفایل عمومی نمایش داده نمی‌شود." />
              <Button type="submit" variant="primary" size="lg" block loading={busy}>دریافت کد</Button>
              <p className="bgv-hint" style={{ justifyContent: 'center' }}><Icon name="shield" size="sm" style={{ marginBlockStart: 3 }} />کد یک‌بارمصرف با پیامک ارسال می‌شود.</p>
              <p className="ac-login__legal">ورود یا ثبت‌نام به معنی پذیرش <Link to="/terms">قوانین و مقررات</Link> و <Link to="/privacy">حریم خصوصی</Link> است.</p>
            </form>
          )}

          {step.kind === 'code' && (
            <form className="ac-stack" style={{ gap: 18 }} onSubmit={(e) => verify(e)} noValidate key="code">
              <div className="ac-login__head">
                <h1 className="t-page">کد ورود</h1>
                <p className="t-body-sm bgv-muted">کد شش‌رقمی ارسال‌شده به <bdi dir="ltr" style={{ color: 'var(--text)', fontWeight: 700 }}>{fa(step.mobile)}</bdi> را وارد کنید.</p>
              </div>
              {step.fixture && <Banner tone="warning" icon="info" text="حالت آزمایشی: پیامکی ارسال نشد. کد ورود آزمایشی را از مدیر سایت بگیرید." />}
              <div className="ac-otp">
                <OtpField value={code} onChange={setCode} onComplete={(v) => verify(undefined, v)} disabled={busy} invalid={!!error} label="کد تأیید" />
                {error && <p className="bgv-hint bgv-hint--error" role="alert"><Icon name="circle-alert" size="sm" style={{ marginBlockStart: 3 }} />{error}</p>}
              </div>
              <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={code.length < 6}>ورود</Button>
              <div className="ac-resend">
                {wait > 0
                  ? <span aria-live="polite">ارسال دوباره تا <b className="bgv-num">{fa(wait)}</b> ثانیه دیگر</span>
                  : <Button type="button" size="sm" disabled={busy} onClick={() => sendCode()}>ارسال دوباره کد</Button>}
                <Button type="button" variant="ghost" size="sm" icon="arrow-right" onClick={() => { setStep({ kind: 'mobile' }); setError(undefined); }}>تغییر شماره</Button>
              </div>
            </form>
          )}

          {step.kind === 'profile' && (
            <form className="ac-stack" style={{ gap: 18 }} onSubmit={saveProfile} noValidate key="profile">
              <div className="ac-login__head">
                <h1 className="t-page">خوش آمدید</h1>
                <p className="t-body-sm bgv-muted">نامی که دیگران سر میز می‌بینند و نماد خود را انتخاب کنید.</p>
              </div>
              <TextField label={<>نام نمایشی <span className="bgv-muted t-caption">{faNum(name.length)} از ۲۴</span></>} name="displayName" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} error={error}
                hint="۲ تا ۲۴ نویسه؛ نام نمایشی قابل گزارش است." autoFocus />
              <fieldset className="ac-avatars">
                <legend className="bgv-label" style={{ marginBlockEnd: 14 }}>نماد</legend>
                {avatarKeys.map((k) => (
                  <label key={k} className={`ac-avatar${avatar === k ? ' is-on' : ''}`}>
                    <input type="radio" name="avatar" value={k} className="bgv-sr" checked={avatar === k} onChange={() => setAvatar(k)} />
                    <span className={`ac-avatar__art ac-tone-${AVATAR_ART[k]?.tone ?? 'raised'}`}>
                      {AVATAR_ART[k]?.node}
                      {avatar === k && <span className="ac-avatar__check"><Icon name="check" size="sm" /></span>}
                    </span>
                    {AVATAR_FA[k] ?? k}
                  </label>
                ))}
              </fieldset>
              <Button type="submit" variant="primary" size="lg" block loading={busy}>ذخیره و ادامه</Button>
            </form>
          )}
        </Card>
        <span className="bgv-spacer" />
        <nav className="ac-login__links" aria-label="پیوندهای سایت">
          {SITE_LINKS.map(([s, label]) => <Link key={s} to={`/${s}`}>{label}</Link>)}
        </nav>
      </section>

      <section className="bgv-felt ac-login__hero">
        <Logo src="/brand/logo-fa-reversed.svg" height={48} style={{ alignSelf: 'flex-start' }} />
        <div className="ac-login__pitch" style={{ marginBlockStart: 36 }}>
          <h2 className="t-h2" style={{ color: 'var(--felt-ink)', margin: 0 }}>سر میز، با همه.</h2>
          <p className="t-body ac-login__lede">{count ? `${fa(count)} بازی رومیزی، ` : 'بازی‌های رومیزی، '}زنده یا نوبتی؛ با دوستان، باشگاه‌ها یا حریف‌های تازه، هر جا که هستید.</p>
        </div>
        <div className="ac-fan" aria-hidden>
          {FAN.map((g, i) => (
            <img key={g} src={`/covers/${g}.webp?v=2`} alt="" style={{ '--dx': FAN_POS[i]![0], '--dy': `${FAN_POS[i]![1]}px`, '--rot': `${FAN_POS[i]![2]}deg` } as CSSProperties} />
          ))}
        </div>
        {/* Sample of what waits after sign-in (design Login-Desktop): your turn, with a calm clock. */}
        <TurnPill className="ac-login__turn" mine who="شما" text="نوبت شما در کاتان" clock={{ time: '۱۸ ساعت', state: 'calm', p: 0.75 }} aria-hidden />
        <div className="ac-login__seats" aria-hidden>{([1, 2, 3, 5] as const).map((n) => <Seat key={n} n={n} size="lg" />)}</div>
        <div className="bgv-felt-row ac-login__plates" style={{ justifyContent: 'flex-start', gap: 8 }}>
          {count ? <FeltPlate label="بازی" value={fa(count)} /> : null}
          <FeltPlate icon="timer" label="زنده و نوبتی" />
          <FeltPlate icon="trophy" label="لیگ از برنز تا استاد" />
        </div>
      </section>
    </div>
  );
}
