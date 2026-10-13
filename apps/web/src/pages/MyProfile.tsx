import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Link2 } from 'lucide-react';
import { avatarKeys, displayNameSchema, type Me } from '@bg/contracts';
import { Avatar, Button, Input, StateBlock, buttonClass, useToast } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';
import { AVATAR_FA, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ProfileEditor } from './ProfileEditor.tsx';

/** Copies the public profile URL; if the clipboard is blocked, the toast shows the link so it can be copied by hand. */
export function CopyProfileLink({ userId, size = 'md' }: { userId: string; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const copy = async () => {
    const url = `${location.origin}/users/${userId}`;
    try { await navigator.clipboard.writeText(url); toast('success', 'لینک پروفایل کپی شد.'); }
    catch { toast('error', `کپی ممکن نشد؛ این لینک را دستی کپی کنید: ${url}`); }
  };
  return <Button variant="secondary" size={size} onClick={copy}><Link2 className="size-4" aria-hidden />کپی لینک پروفایل</Button>;
}

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
      <div className="row" style={{ alignItems: 'center', gap: '0.75rem' }}>
        <Avatar avatarKey={me.avatarKey} name={me.displayName} size={56} />
        <Link className={buttonClass('secondary', 'md')} to="/me/avatar">ساخت و ویرایش آواتار</Link>
      </div>
      <fieldset className="avatar-picker">
        <legend className="field__label">یا یک نماد ساده</legend>
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

/** My profile: identity (name, avatar) and public customization, separate from device and privacy settings. */
export function MyProfile() {
  usePageTitle('پروفایل من');
  const { me, status } = useSession();
  if (status === 'loading') return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  if (!me) return <StateBlock kind="denied" title="برای ویرایش پروفایل وارد شوید" action={<Link className={buttonClass('primary', 'md')} to="/login?next=/me/profile">ورود</Link>} />;
  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">پروفایل من</h1><p className="page-sub">آنچه دیگران در صفحهٔ پروفایل شما می‌بینند.</p></div>
        <div className="row" style={{ gap: 8 }}>
          <Link className={buttonClass('ghost', 'md')} to={`/users/${me.id}`}>دیدن پروفایل</Link>
          <CopyProfileLink userId={me.id} />
        </div>
      </div>
      <div className="stack" style={{ maxInlineSize: 720 }}>
        <section className="panel stack" aria-labelledby="identity-h">
          <h2 id="identity-h" className="section-title">نام و آواتار</h2>
          <ProfileForm me={me} />
        </section>
        <ProfileEditor me={me} />
      </div>
    </>
  );
}
