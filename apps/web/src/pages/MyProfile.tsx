import { useEffect, useState, type FormEvent } from 'react';
import { avatarKeys, cosmetic, displayNameSchema, parseAvatar, type Me } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Avatar, Button, Card, Chip, Icon, ListItem, PageHead, ProfileHead, Progress, StateBlock, TextField } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { AVATAR_FA, faNum, jalaliDate } from '../lib/format.ts';
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

/** The seven things that make a profile «کامل», in the order the card lists the missing ones. */
const COMPLETE: [string, (m: Me) => boolean][] = [
  ['نام نمایشی', (m) => m.profileCompleted], ['آواتار ساخته‌شده', (m) => !!parseAvatar(m.avatarKey)], ['معرفی کوتاه', (m) => !!m.bio],
  ['لقب', (m) => !!m.titleKey], ['بنر', (m) => !!m.bannerKey && m.bannerKey !== 'bn.0'], ['بازی‌های محبوب', (m) => m.favoriteGames.length > 0],
  ['ویترین جام‌ها', (m) => m.showcase.length > 0]
];

function Overview({ me }: { me: Me }) {
  const id = userIdentity(me);
  const missing = COMPLETE.filter(([, ok]) => !ok(me)).map(([label]) => label);
  const done = COMPLETE.length - missing.length;
  const bannerCss = me.bannerKey && me.bannerKey !== 'bn.0' ? cosmetic(me.bannerKey)?.css : undefined;
  return (
    <>
      <ProfileHead name={<bdi>{me.displayName}</bdi>} initials={id.initials} avatar={{ ...id.avatar, name: `آواتار ${me.displayName}` }} title={id.title}
        bannerArt={bannerCss ? <div className="pf-bn" style={{ '--bn': bannerCss } as React.CSSProperties} /> : undefined}
        meta={[`عضو از ${jalaliDate(me.joinedAt)}`]}
        actions={<><Button variant="ghost" icon="eye" href={`/users/${me.id}`}>دیدن پروفایل</Button><CopyProfileLink userId={me.id} /></>} />
      {missing.length > 0 && (
        <Card className="bgv-stack" aria-label="کامل کردن پروفایل">
          <Progress value={done / COMPLETE.length} label="پروفایل شما" valueText={`${faNum(done)} از ${faNum(COMPLETE.length)} کامل`} tone="invite" />
          <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>مانده: {missing.join('، ')}</p>
          <div><Button size="sm" variant="primary" icon="palette" href="/me/studio">کامل کردن در استودیو</Button></div>
        </Card>
      )}
      <Card flush aria-label="بخش‌های پروفایل">
        <ListItem icon="palette" title="استودیو پروفایل" sub="آواتار، قاب، لقب، بنر، ویترین" href="/me/studio" trailing={<Icon name="chevron-left" />} />
        <ListItem icon="shirt" title="کمد" sub="آیتم‌های میز و چت" href="/me/wardrobe" trailing={<Icon name="chevron-left" />} />
        <ListItem icon="shopping-bag" title="فروشگاه" sub="خرید با سکه" href="/shop" trailing={<Icon name="chevron-left" />} />
        <ListItem icon="trophy" title="پیشرفت" sub="سطح، مأموریت‌ها و دستاوردها" href="/progress" trailing={<Icon name="chevron-left" />} />
      </Card>
    </>
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
      <PageHead title="پروفایل من" sub="آنچه دیگران در صفحهٔ پروفایل شما می‌بینند." />
      <div className="bgv-stack">
        <Overview me={me} />
        <Card title="نام و آواتار" aria-label="نام و آواتار"><ProfileForm me={me} /></Card>
        <InviteCard />
        <ProfileEditor me={me} />
      </div>
    </>
  );
}
