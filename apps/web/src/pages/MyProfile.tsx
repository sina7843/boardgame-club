import { useEffect, useState, type FormEvent } from 'react';
import { avatarKeys, displayNameSchema, type Me } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Avatar, Button, Card, Chip, PageHead, StateBlock, TextField } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { AVATAR_FA, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ProfileEditor } from './ProfileEditor.tsx';
import { InviteCard } from '../social/InviteCard.tsx';

/** Copies the public profile URL; if the clipboard is blocked, the toast shows the link so it can be copied by hand. */
export function CopyProfileLink({ userId, size = 'md' }: { userId: string; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const copy = async () => {
    const url = `${location.origin}/users/${userId}`;
    try { await navigator.clipboard.writeText(url); toast('success', 'لینک پروفایل کپی شد.'); }
    catch { toast('error', `کپی ممکن نشد؛ این لینک را دستی کپی کنید: ${url}`); }
  };
  return <Button variant="secondary" size={size} icon="link" onClick={copy}>کپی لینک پروفایل</Button>;
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
    <form className="bgv-stack" onSubmit={save} noValidate>
      <TextField label="نام نمایشی" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} error={error} hint="۲ تا ۲۴ نویسه" />
      <div className="bgv-row">
        <Avatar size="lg" {...userIdentity(me).avatar} name={`آواتار ${me.displayName}`} />
        <Button variant="secondary" icon="palette" href="/me/avatar">ساخت و ویرایش آواتار</Button>
        <Button variant="ghost" icon="shirt" href="/me/studio">استودیو و کمد</Button>
      </div>
      <div className="bgv-stack" role="group" aria-label="یا یک نماد ساده" style={{ gap: 'var(--space-2)' }}>
        <span className="t-label">یا یک نماد ساده</span>
        <div className="bgv-row">
          {avatarKeys.map((k) => <Chip key={k} selected={avatar === k} onClick={() => setAvatar(k)}>{AVATAR_FA[k] ?? k}</Chip>)}
        </div>
      </div>
      <dl className="bgv-stack" style={{ margin: 0, gap: 'var(--space-2)' }}>
        <div><dt className="t-caption bgv-muted">شماره موبایل (فقط برای شما)</dt><dd style={{ margin: 0 }}><bdi dir="ltr">{me.mobileMasked}</bdi></dd></div>
        <div><dt className="t-caption bgv-muted">عضویت از</dt><dd style={{ margin: 0 }}>{jalaliDate(me.joinedAt)}</dd></div>
      </dl>
      <div><Button type="submit" variant="primary" loading={busy}>ذخیره پروفایل</Button></div>
    </form>
  );
}

/** My profile: identity (name, avatar) and public customization, separate from device and privacy settings. */
export function MyProfile() {
  usePageTitle('پروفایل من');
  const { me, status } = useSession();
  if (status === 'loading') return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  if (!me) return <StateBlock kind="denied" title="برای ویرایش پروفایل وارد شوید" action={<Button variant="primary" href="/login?next=/me/profile">ورود</Button>} />;
  return (
    <>
      <PageHead title="پروفایل من" sub="آنچه دیگران در صفحهٔ پروفایل شما می‌بینند."
        actions={<><Button variant="ghost" icon="eye" href={`/users/${me.id}`}>دیدن پروفایل</Button><CopyProfileLink userId={me.id} /></>} />
      <div className="bgv-stack">
        <Card title="نام و آواتار" aria-label="نام و آواتار"><ProfileForm me={me} /></Card>
        <InviteCard />
        <ProfileEditor me={me} />
      </div>
    </>
  );
}
