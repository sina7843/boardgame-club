import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Me } from '@bg/contracts';
import { Button, Card, Checkbox, Dialog, TextField } from '@bg/ui/bgv';
import { useToast } from '@bg/ui';
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
  if (!me || me.termsAccepted || !me.profileCompleted || READABLE.includes(pathname)) return null;
  const accept = async () => {
    setBusy(true);
    try { setMe(await api<Me>('/me/terms', { method: 'POST' })); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد؛ دوباره تلاش کنید.'); }
    finally { setBusy(false); }
  };
  // Acceptance is required, so the dialog has no close button and Esc/backdrop do nothing.
  return (
    <Dialog modal title="قوانین و حریم خصوصی" icon="shield"
      footer={<Button variant="primary" loading={busy} disabled={!checked} onClick={() => void accept()}>می‌پذیرم و ادامه</Button>}>
      <p style={{ marginBlockStart: 0 }}>برای ادامه‌ی استفاده از سایت، لطفاً قوانین و سیاست حریم خصوصی را بخوانید و بپذیرید.</p>
      <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} autoFocus
        label={<span><a href="/terms" target="_blank" rel="noreferrer">قوانین و مقررات</a>، <a href="/privacy" target="_blank" rel="noreferrer">حریم خصوصی</a> و <a href="/refund" target="_blank" rel="noreferrer">قوانین خرید</a> را خوانده‌ام و می‌پذیرم.</span>} />
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
    <Card as="section" title="حذف حساب کاربری">
      <div className="bgv-stack">
        <p className="bgv-muted" style={{ margin: 0 }}>نام، نماد، پروفایل، دوستان و شماره موبایل شما حذف می‌شود و از همه‌ی دستگاه‌ها خارج می‌شوید. سوابق بازی‌ها و پیام‌های قبلی با نام «کاربر حذف‌شده» باقی می‌ماند. سکه، اشتراک و دستاوردها از بین می‌روند و این کار برگشت‌پذیر نیست.</p>
        <div><Button variant="danger" icon="trash-2" onClick={() => { setTyped(''); setOpen(true); }}>حذف حساب</Button></div>
      </div>
      {open && (
        <Dialog modal danger title="حذف همیشگی حساب" onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>انصراف</Button>
            <Button variant="danger" loading={busy} disabled={typed.trim() !== 'حذف'} onClick={() => void remove()}>حذف همیشگی</Button></>}>
          <p style={{ marginBlockStart: 0 }}>این کار برگشت‌پذیر نیست. اگر بعداً با همین شماره وارد شوید، یک حساب تازه و خالی ساخته می‌شود.</p>
          <TextField label="برای تأیید، کلمه‌ی «حذف» را بنویسید" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Dialog>
      )}
    </Card>
  );
}
