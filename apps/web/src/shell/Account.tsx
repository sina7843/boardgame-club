import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { Me } from '@bg/contracts';
import { Button, Dialog, Input, useToast } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';

/** Pages the user must be able to read before accepting (they also open in a new tab from the dialog). */
const READABLE = ['/login', '/terms', '/privacy', '/refund', '/about', '/contact'];

/** Asks a signed-in user to accept the current terms (first login, or after the admin requires re-acceptance). */
export function TermsGate() {
  const { me, setMe } = useSession();
  const { pathname } = useLocation();
  const toast = useToast();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reopen, setReopen] = useState(0);
  if (!me || me.termsAccepted || !me.profileCompleted || READABLE.includes(pathname)) return null;
  const accept = async () => {
    setBusy(true);
    try { setMe(await api<Me>('/me/terms', { method: 'POST' })); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد؛ دوباره تلاش کنید.'); }
    finally { setBusy(false); }
  };
  // Acceptance is required: closing (Esc/backdrop) brings the dialog straight back.
  return (
    <Dialog key={reopen} open onClose={() => setReopen(reopen + 1)} title="قوانین و حریم خصوصی"
      footer={<Button busy={busy} disabled={!checked} onClick={() => void accept()}>می‌پذیرم و ادامه</Button>}>
      <p style={{ marginBlockStart: 0 }}>برای ادامهٔ استفاده از سایت، لطفاً قوانین و سیاست حریم خصوصی را بخوانید و بپذیرید.</p>
      <label className="row" style={{ alignItems: 'start', gap: '0.5rem' }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginBlockStart: '0.35rem' }} data-autofocus />
        <span><Link className="underline" to="/terms" target="_blank">قوانین و مقررات</Link>، <Link className="underline" to="/privacy" target="_blank">حریم خصوصی</Link> و <Link className="underline" to="/refund" target="_blank">قوانین خرید</Link> را خوانده‌ام و می‌پذیرم.</span>
      </label>
    </Dialog>
  );
}

/** Settings section: permanent self-service account deletion, confirmed by typing «حذف». */
export function DeleteAccount() {
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
    <section className="panel stack" aria-labelledby="delete-h">
      <h2 id="delete-h" className="section-title">حذف حساب کاربری</h2>
      <p className="muted" style={{ margin: 0 }}>نام، نماد، پروفایل، دوستان و شماره موبایل شما حذف می‌شود و از همهٔ دستگاه‌ها خارج می‌شوید. سوابق بازی‌ها و پیام‌های قبلی با نام «کاربر حذف‌شده» باقی می‌ماند. سکه، اشتراک و دستاوردها از بین می‌روند و این کار برگشت‌پذیر نیست.</p>
      <div><Button variant="danger" onClick={() => { setTyped(''); setOpen(true); }}>حذف حساب</Button></div>
      <Dialog open={open} onClose={() => setOpen(false)} title="حذف همیشگی حساب"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
          <Button variant="danger" busy={busy} disabled={typed.trim() !== 'حذف'} onClick={() => void remove()}>حذف همیشگی</Button></>}>
        <p style={{ marginBlockStart: 0 }}>این کار برگشت‌پذیر نیست. اگر بعداً با همین شماره وارد شوید، یک حساب تازه و خالی ساخته می‌شود.</p>
        <Input label="برای تأیید، کلمهٔ «حذف» را بنویسید" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Dialog>
    </section>
  );
}
