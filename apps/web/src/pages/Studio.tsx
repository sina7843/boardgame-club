import { useState } from 'react';
import { KIND_FA, ITEM_KINDS, KIND_SLOT, cosmetic, type ProfilePrivacy } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Badge, Button, Card, CosmeticTile, Identity, LobbySeat, PageHead, PlayerCard, StateBlock, Switch } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { ItemArt, useWardrobe } from '../lib/cosmeticItems.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ProfileEditor } from './ProfileEditor.tsx';

const PRIVACY: [keyof ProfilePrivacy, string, string][] = [
  ['showStats', 'آمار و تسلط', 'تعداد بازی، برد و نرخ برد و رتبهٔ تسلط در هر بازی'],
  ['showRatings', 'امتیاز و لیگ', 'امتیاز رتبه‌دار و بهترین لیگ'],
  ['showRecent', 'بازی‌های اخیر', 'پنج بازی اخیر در میزهای عمومی؛ میز خصوصی هرگز نمایش داده نمی‌شود']
];

/** Profile studio: the one place that gathers identity, avatar, what I wear and who sees my record. */
export function StudioPage() {
  usePageTitle('استودیو پروفایل');
  const { me } = useSession();
  const toast = useToast();
  const w = useWardrobe();
  const privacy = useApi<ProfilePrivacy>(me ? '/me/profile-privacy' : null);
  const [saving, setSaving] = useState<string>();

  if (!me) return <StateBlock kind="denied" title="برای ورود به استودیو وارد شوید" action={<Button variant="primary" href="/login?next=/me/studio">ورود</Button>} />;
  if (w.owned.error) return <StateBlock kind="error" title="استودیو دریافت نشد" action={<Button variant="primary" onClick={w.owned.reload}>تلاش دوباره</Button>} />;
  if (!w.d || !privacy.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;

  const setPrivacy = async (key: keyof ProfilePrivacy, value: boolean) => {
    setSaving(key);
    try { await api('/me/profile-privacy', { method: 'PUT', body: { ...privacy.data, [key]: value } }); privacy.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره انجام نشد.'); }
    finally { setSaving(undefined); }
  };
  const worn = (slot: string, key: string | null | undefined) => cosmetic(key ?? `${slot}.0`);
  const bubble = worn('bu', w.d.equipped.chatBubble);
  const id = userIdentity(me);
  const ring = worn('sr', w.d.equipped.seatRing);

  return (
    <>
      <PageHead title="استودیو پروفایل" sub="هرچه اینجا انتخاب کنید همه‌جا با شما می‌آید: پروفایل، سر میز، گفت‌وگو و لابی."
        actions={<><Button variant="primary" icon="palette" href="/me/avatar">ساخت آواتار</Button><Button variant="secondary" icon="eye" href={`/users/${me.id}`}>دیدن پروفایل</Button></>} />
      <div className="bgv-cols">
        <div className="bgv-stack">
          <Card title="آنچه می‌پوشید" aria-label="آنچه می‌پوشید" actions={<Button size="sm" variant="secondary" href="/me/wardrobe">کمد</Button>}>
            <div className="pf-tiles">
              {ITEM_KINDS.map((k) => {
                const c = worn(KIND_SLOT[k], w.d!.equipped[k]);
                return c ? <CosmeticTile key={k} name={`${KIND_FA[k]}: ${c.nameFa}`} state="equipped" rarity={w.rarity(c)}art={<ItemArt item={c} me={me} />} /> : null;
              })}
            </div>
          </Card>
          <Card title="نام و آواتار" aria-label="نام و آواتار">
            <div className="bgv-row">
              <Button variant="secondary" icon="pencil" href="/me/profile">ویرایش نام و پروفایل</Button>
              <Button variant="secondary" icon="palette" href="/me/avatar">ساخت آواتار</Button>
            </div>
          </Card>
          <ProfileEditor me={me} />
          <Card title="چه کسی چه چیزی می‌بیند" aria-label="حریم خصوصی پروفایل">
            <div className="bgv-stack">
              {PRIVACY.map(([key, label, hint]) => (
                <Switch key={key} label={label} hint={hint} checked={privacy.data![key]} disabled={saving === key} onChange={(v: boolean) => setPrivacy(key, v)} />
              ))}
              <p className="t-caption bgv-muted">سطح شما همیشه دیده می‌شود. مسدودشده‌ها هیچ‌چیز از سابقهٔ شما نمی‌بینند.</p>
            </div>
          </Card>
        </div>
        <Card title="پیش‌نمایش زنده" aria-label="پیش‌نمایش زنده">
          <div className="bgv-stack">
            <span className="t-caption bgv-muted">صندلی سر میز</span>
            <div className="pf-seatprev">
              {ring && <ItemArt item={ring} me={me} />}
              <Identity {...userIdentity(me, { size: 'md' })} />
            </div>
            <span className="t-caption bgv-muted">پیام در گفت‌وگو</span>
            {bubble && <ItemArt item={bubble} me={me} />}
            <span className="t-caption bgv-muted">کارت بازیکن سر میز</span>
            <div className="pf-prevfelt"><PlayerCard {...id} name={<bdi>{me.displayName}</bdi>} you seat={1} turn waiting="در حال بازی" /></div>
            <span className="t-caption bgv-muted">صندلی در لابی</span>
            <LobbySeat {...id} name={<bdi>{me.displayName}</bdi>} you ready seat={1} />
            <span className="t-caption bgv-muted">ردیف رتبه‌بندی</span>
            <div className="pf-prevrow"><b className="bgv-num">۱۲۸</b><Identity {...userIdentity(me, { size: 'sm', you: true })} /></div>
            <Badge tone="info" icon="eye">دیگران دقیقاً همین‌طور می‌بینند.</Badge>
          </div>
        </Card>
      </div>
    </>
  );
}
