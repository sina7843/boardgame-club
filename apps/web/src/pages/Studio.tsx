import { useState } from 'react';
import { KIND_FA, ITEM_KINDS, KIND_SLOT, cosmetic, slotItems, type ProfilePrivacy } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Avatar, Badge, Banner, Breadcrumbs, Button, Card, CosmeticTile, Identity, LobbySeat, PageHead, PlayerCard, Segmented, StateBlock, Switch, Tabs } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { faNum } from '../lib/format.ts';
import { ItemArt, useWardrobe } from '../lib/cosmeticItems.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ProfileEditor, useProfileDraft, type EditorTab } from './ProfileEditor.tsx';

const PRIVACY: [keyof ProfilePrivacy, string, string][] = [
  ['showStats', 'آمار و تسلط', 'تعداد بازی، برد و نرخ برد و رتبهٔ تسلط در هر بازی'],
  ['showRatings', 'امتیاز و لیگ', 'امتیاز رتبه‌دار و بهترین لیگ'],
  ['showRecent', 'بازی‌های اخیر', 'پنج بازی اخیر در میزهای عمومی؛ میز خصوصی هرگز نمایش داده نمی‌شود']
];
type StudioTab = 'avatar' | 'frame' | EditorTab | 'table';

/** Profile studio (Studio-Desktop): one tabbed editor, a live preview of every place the profile shows, and one save for the profile fields.
 *  Frames and table cosmetics are worn at once (as in the wardrobe); bio, title, banner, favourites and showcase wait for «ذخیرهٔ همه». */
export function StudioPage() {
  usePageTitle('استودیو پروفایل');
  const { me } = useSession();
  const toast = useToast();
  const w = useWardrobe();
  const privacy = useApi<ProfilePrivacy>(me ? '/me/profile-privacy' : null);
  const [saving, setSaving] = useState<string>();
  const [tab, setTab] = useState<StudioTab>('frame');
  const [frames, setFrames] = useState<'all' | 'mine' | 'locked'>('all');

  if (!me) return <StateBlock kind="denied" title="برای ورود به استودیو وارد شوید" action={<Button variant="primary" href="/login?next=/me/studio">ورود</Button>} />;
  if (w.owned.error) return <StateBlock kind="error" title="استودیو دریافت نشد" action={<Button variant="primary" onClick={w.owned.reload}>تلاش دوباره</Button>} />;
  if (!w.d || !privacy.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  return <Studio me={me} w={w} privacy={privacy.data} saving={saving} tab={tab} setTab={setTab} frames={frames} setFrames={setFrames}
    setPrivacy={async (key, value) => {
      setSaving(key);
      try { await api('/me/profile-privacy', { method: 'PUT', body: { ...privacy.data, [key]: value } }); privacy.reload(); }
      catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره انجام نشد.'); }
      finally { setSaving(undefined); }
    }} />;
}

function Studio({ me, w, privacy, saving, tab, setTab, frames, setFrames, setPrivacy }: {
  me: NonNullable<ReturnType<typeof useSession>['me']>; w: ReturnType<typeof useWardrobe>; privacy: ProfilePrivacy; saving: string | undefined;
  tab: StudioTab; setTab: (t: StudioTab) => void; frames: 'all' | 'mine' | 'locked'; setFrames: (f: 'all' | 'mine' | 'locked') => void;
  setPrivacy: (key: keyof ProfilePrivacy, value: boolean) => Promise<void>;
}) {
  const draft = useProfileDraft(me);
  const [pv, setPv] = useState<'table' | 'chat' | 'rank'>('table');
  const d = w.d!;
  const worn = (slot: string, key: string | null | undefined) => cosmetic(key ?? `${slot}.0`);
  const bubble = worn('bu', d.equipped.chatBubble);
  // The preview shows the draft title so a change is visible before saving.
  const draftMe = { ...me, titleKey: draft.titleKey };
  const id = userIdentity(draftMe);
  const dot = (on: boolean, label: string) => (on ? `• ${label}` : label);
  const frameItems = slotItems('fr').filter((c) => frames === 'all' || (frames === 'mine') === w.unlocked.has(c.key));
  const ownedFrames = slotItems('fr').filter((c) => w.unlocked.has(c.key)).length;

  return (
    <>
      <Breadcrumbs className="app-hide-phone" items={[{ label: 'پروفایل من', href: '/me/profile' }, { label: 'استودیو پروفایل' }]} />
      <PageHead className="app-hide-phone" title="استودیو پروفایل" sub="هرچه اینجا انتخاب کنید همه‌جا با شما می‌آید: کارت بازیکن سر میز، گفت‌وگو، لابی و جدول رتبه."
        actions={<>
          {draft.dirty > 0 && <Badge tone="warning" icon="pencil">{faNum(draft.dirty)} تغییر ذخیره‌نشده</Badge>}
          <Button variant="secondary" icon="smile" href="/me/avatar">ساخت آواتار</Button>
          <Button variant="secondary" disabled={!draft.dirty} onClick={draft.reset}>لغو تغییرات</Button>
          <Button variant="primary" icon="check" loading={draft.busy} disabled={!draft.dirty} onClick={draft.save}>ذخیرهٔ همه</Button>
        </>} />
      <div className="bgv-cols pf-studio">
        <div className="bgv-stack">
          <section className="bgv-card pf-pcard" aria-label="ویرایشگر پروفایل" data-tour="profile-editor">
            <Tabs label="بخش‌های استودیو" value={tab} onChange={(v) => setTab(v as StudioTab)} items={[
              { value: 'avatar', label: 'آواتار' }, { value: 'frame', label: 'قاب' }, { value: 'about', label: dot(draft.changed.about, 'معرفی و لقب') },
              { value: 'banner', label: dot(draft.changed.banner, 'بنر') }, { value: 'fav', label: dot(draft.changed.fav, 'بازی‌های محبوب') },
              { value: 'showcase', label: dot(draft.changed.showcase, 'ویترین') }, { value: 'table', label: 'کازمتیک میز' }
            ]} />
            {tab === 'avatar' && (
              <div className="pf-studio__avatar">
                <Avatar {...id.avatar} initials={id.initials} size="2xl" />
                <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>آواتار یازده لایه دارد: چهره، مو، چشم، لباس و پس‌زمینه. در سازنده هر لایه را جدا انتخاب کنید.</p>
                <Button variant="primary" icon="smile" href="/me/avatar">باز کردن سازندهٔ آواتار</Button>
              </div>
            )}
            {tab === 'frame' && <>
              <div className="bgv-row"><p className="t-body-sm" style={{ margin: 0, flex: 1 }}>قاب دور آواتار شما در همه‌جا دیده می‌شود. {faNum(ownedFrames)} از {faNum(slotItems('fr').length)} قاب را دارید.</p>
                <Segmented label="نمایش قاب‌ها" value={frames} onChange={(v) => setFrames(v as typeof frames)} options={[{ value: 'all', label: 'همه' }, { value: 'mine', label: 'دارم' }, { value: 'locked', label: 'قفل' }]} /></div>
              <div className="pf-tiles pf-tiles--frames">
                {frameItems.map((c) => {
                  const st = w.stateOf(c);
                  return <CosmeticTile key={c.key} name={c.nameFa} state={st} premium={'premium' in c.unlock && st === 'locked'}
                    price={st === 'locked' && 'coins' in c.unlock ? c.unlock.coins : undefined} lockText={st === 'locked' ? w.reason(c) : undefined}
                    art={<ItemArt item={c} me={draftMe} />} onClick={() => { if (st === 'owned') void w.equip(c); else if (st === 'locked' && 'coins' in c.unlock) location.assign('/shop'); }} />;
                })}
              </div>
              <Banner tone="info" icon="info" title="قاب لیگ برای همیشه مال شماست" text="بهترین لیگی که در هر بازی و هر فصل گرفته‌اید حساب است؛ اگر لیگ‌تان پایین بیاید، قاب از دست نمی‌رود." />
            </>}
            {(tab === 'about' || tab === 'banner' || tab === 'fav' || tab === 'showcase') && <ProfileEditor me={me} draft={draft} tab={tab} />}
            {tab === 'table' && <>
              <div className="pf-tiles">
                {ITEM_KINDS.map((k) => {
                  const c = worn(KIND_SLOT[k], d.equipped[k]);
                  return c ? <CosmeticTile key={k} name={`${KIND_FA[k]}: ${c.nameFa}`} state="equipped" art={<ItemArt item={c} me={me} />} /> : null;
                })}
              </div>
              <div><Button variant="secondary" icon="shirt" href="/me/wardrobe">عوض کردن در کمد</Button></div>
            </>}
          </section>
          <Card title="چه کسی چه چیزی می‌بیند" aria-label="حریم خصوصی پروفایل">
            <div className="bgv-stack">
              {PRIVACY.map(([key, label, hint]) => (
                <Switch key={key} label={label} hint={hint} checked={privacy[key]} disabled={saving === key} onChange={(v: boolean) => void setPrivacy(key, v)} />
              ))}
              <p className="t-caption bgv-muted">سطح شما همیشه دیده می‌شود. مسدودشده‌ها هیچ‌چیز از سابقهٔ شما نمی‌بینند.</p>
            </div>
          </Card>
        </div>
        <section className={`bgv-card pf-pcard pf-studio__preview is-${pv}`} aria-labelledby="preview-h">
          <div className="bgv-row"><h2 id="preview-h" className="pf-h2">پیش‌نمایش زنده</h2>
            {/* Studio-Mobile: one preview at a time above the editor. */}
            <Segmented className="app-phone-only" label="پیش‌نمایش" value={pv} onChange={(v) => setPv(v as typeof pv)}
              options={[{ value: 'table', label: 'میز' }, { value: 'chat', label: 'گفت‌وگو' }, { value: 'rank', label: 'رتبه' }]} /></div>
          <span className="t-caption bgv-muted pf-pv--table">کارت بازیکن سر میز</span>
          <div className="pf-prevfelt pf-pv--table"><PlayerCard {...id} name={<bdi>{me.displayName}</bdi>} you seat={1} turn waiting="در حال بازی" /></div>
          <span className="t-caption bgv-muted pf-pv--chat">پیام در گفت‌وگو</span>
          <div className="pf-prevchat pf-pv--chat"><Identity {...userIdentity(draftMe, { size: 'sm' })} />{bubble && <ItemArt item={bubble} me={me} />}</div>
          <span className="t-caption bgv-muted pf-pv--table">صندلی در لابی</span>
          <LobbySeat className="pf-pv--table" {...id} name={<bdi>{me.displayName}</bdi>} you ready seat={1} />
          <span className="t-caption bgv-muted pf-pv--rank">ردیف جدول رتبه</span>
          <div className="pf-prevrow pf-pv--rank"><b className="bgv-num">۱۲۸</b><Identity {...userIdentity(draftMe, { size: 'sm', you: true })} /></div>
          <span className="t-caption bgv-muted"><Badge tone="info" icon="eye">دیگران دقیقاً همین‌طور می‌بینند.</Badge></span>
        </section>
      </div>
      {draft.dirty > 0 && (
        <div className="pf-savebar app-phone-only" role="status">
          <Button variant="secondary" onClick={draft.reset}>لغو</Button>
          <Button variant="primary" icon="check" loading={draft.busy} onClick={draft.save}>ذخیرهٔ تغییرات</Button>
        </div>
      )}
    </>
  );
}
