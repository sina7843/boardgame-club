import { useEffect, useMemo, useState } from 'react';
import { bioSchema, slotItems, unlockFa, type Me, type TrophyTier } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Button, Card, Chip, CosmeticTile, Select, Tabs, Textarea } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';

interface Owned { unlocked: string[]; achievements: Record<string, string> }
const MAX_FAV = 3;
const MAX_SHOWCASE = 5;
const TITLES = slotItems('t').slice(1);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Unsaved profile changes (bio, title, banner, favourites, showcase), saved together with «ذخیرهٔ همه». */
export function useProfileDraft(me: Me) {
  const { setMe } = useSession();
  const toast = useToast();
  const [bio, setBio] = useState(me.bio ?? '');
  const [titleKey, setTitle] = useState(me.titleKey);
  const [bannerKey, setBanner] = useState(me.bannerKey);
  const [fav, setFav] = useState(me.favoriteGames);
  const [showcase, setShowcase] = useState(me.showcase);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const reset = () => { setBio(me.bio ?? ''); setTitle(me.titleKey); setBanner(me.bannerKey); setFav(me.favoriteGames); setShowcase(me.showcase); setError(undefined); };
  useEffect(reset, [me]);
  const changed = { about: bio !== (me.bio ?? '') || titleKey !== me.titleKey, banner: bannerKey !== me.bannerKey, fav: !same(fav, me.favoriteGames), showcase: !same(showcase, me.showcase) };
  const dirty = [bio !== (me.bio ?? ''), titleKey !== me.titleKey, bannerKey !== me.bannerKey, changed.fav, changed.showcase].filter(Boolean).length;
  const save = async () => {
    const b = bioSchema.safeParse(bio);
    if (!b.success) { setError(b.error.issues[0]?.message); return; }
    setBusy(true); setError(undefined);
    try {
      setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { bio: b.data || null, titleKey, bannerKey, favoriteGames: fav, showcase } }));
      toast('success', 'پروفایل ذخیره شد.');
    } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'ذخیره انجام نشد.'); }
    finally { setBusy(false); }
  };
  return { bio, setBio, titleKey, setTitle, bannerKey, setBanner, fav, setFav, showcase, setShowcase, error, busy, dirty, changed, save, reset };
}
export type ProfileDraft = ReturnType<typeof useProfileDraft>;

export type EditorTab = 'about' | 'banner' | 'fav' | 'showcase';

/** Title, banner, bio, favourite games and trophy showcase. Locked options are shown with how to unlock them.
 *  Standalone it keeps its own draft and save bar; the studio passes its draft, its own tabs and the panel to show. */
export function ProfileEditor({ me, draft: given, tab: forced }: { me: Me; draft?: ProfileDraft; tab?: EditorTab }) {
  const own = useProfileDraft(me);
  const d = given ?? own;
  const owned = useApi<Owned>('/me/cosmetics');
  const gamesApi = useApi<{ items: { id: string; nameFa: string }[] }>('/games');
  const ach = useApi<{ items: { key: string; titleFa: string; tier: TrophyTier }[] }>(`/users/${me.id}/achievements`);
  const [ownTab, setTab] = useState<EditorTab>('about');
  const tab = forced ?? ownTab;
  const unlocked = useMemo(() => new Set(owned.data?.unlocked ?? []), [owned.data]);
  const reason = (u: Parameters<typeof unlockFa>[0]) => unlockFa(u, (k) => owned.data?.achievements[k]);
  const toggle = (list: string[], set: (l: string[]) => void, k: string, max: number) =>
    set(list.includes(k) ? list.filter((x) => x !== k) : list.length < max ? [...list, k] : list);

  const body = (
    <>
      {tab === 'about' && <>
        <Textarea label="معرفی کوتاه" rows={3} maxLength={160} value={d.bio} onChange={(e) => d.setBio(e.target.value)} placeholder="مثلاً: عاشق کاتان، شب‌ها آنلاینم"
          hint={`${faNum(d.bio.length)} از ۱۶۰ نویسه، برای همه دیده می‌شود`} />
        <Select label="لقب" value={d.titleKey ?? ''} onChange={(e) => d.setTitle(e.target.value || null)}
          options={[{ value: '', label: 'بدون لقب' }, ...TITLES.filter((t) => unlocked.has(t.key)).map((t) => ({ value: t.key, label: t.nameFa }))]} />
        {TITLES.some((t) => !unlocked.has(t.key)) && (
          <p className="t-caption bgv-muted">لقب‌های قفل: {TITLES.filter((t) => !unlocked.has(t.key)).map((t) => `${t.nameFa} (${reason(t.unlock)})`).join('، ')}</p>
        )}
      </>}
      {tab === 'banner' && <div className="bgv-stack" role="group" aria-label="بنر پروفایل" style={{ gap: 'var(--space-2)' }}>
        <span className="t-label">بنر پروفایل</span>
        <div className="pf-tiles">
          {slotItems('bn').map((b) => {
            const locked = !unlocked.has(b.key);
            const on = (d.bannerKey ?? 'bn.0') === b.key;
            return (
              <CosmeticTile key={b.key} name={b.nameFa} state={locked ? 'locked' : on ? 'equipped' : 'owned'} lockText={locked ? reason(b.unlock) : undefined}
                aria-label={locked ? `${b.nameFa}، ${reason(b.unlock)}` : b.nameFa} aria-pressed={on} {...({ disabled: locked } as object)}
                art={<span className="pf-swbar" style={{ '--sw': b.css } as React.CSSProperties} />}
                onClick={() => d.setBanner(b.key === 'bn.0' ? null : b.key)} />
            );
          })}
        </div>
      </div>}
      {tab === 'fav' && <div className="bgv-stack" role="group" aria-label="بازی‌های محبوب" style={{ gap: 'var(--space-2)' }}>
        <span className="t-label">بازی‌های محبوب (تا {faNum(MAX_FAV)} بازی)</span>
        {gamesApi.data ? (
          <div className="bgv-row">
            {gamesApi.data.items.map((g) => (
              <Chip key={g.id} selected={d.fav.includes(g.id)} {...({ disabled: !d.fav.includes(g.id) && d.fav.length >= MAX_FAV } as object)} onClick={() => toggle(d.fav, d.setFav, g.id, MAX_FAV)}>{g.nameFa}</Chip>
            ))}
          </div>
        ) : <p className="bgv-muted" role="status">در حال بارگذاری…</p>}
      </div>}
      {tab === 'showcase' && <div className="bgv-stack" role="group" aria-label="ویترین جام‌ها" style={{ gap: 'var(--space-2)' }}>
        <span className="t-label">ویترین جام‌ها (تا {faNum(MAX_SHOWCASE)} جام، اول نمایش داده می‌شوند)</span>
        {!ach.data ? <p className="bgv-muted" role="status">در حال بارگذاری…</p>
          : ach.data.items.length === 0 ? <p className="bgv-muted">هنوز جامی ندارید؛ با بازی کردن دستاورد بگیرید.</p>
          : (
            <div className="bgv-row">
              {ach.data.items.map((a) => (
                <Chip key={a.key} icon="trophy" selected={d.showcase.includes(a.key)} {...({ disabled: !d.showcase.includes(a.key) && d.showcase.length >= MAX_SHOWCASE } as object)}
                  onClick={() => toggle(d.showcase, d.setShowcase, a.key, MAX_SHOWCASE)}>{a.titleFa}</Chip>
              ))}
            </div>
          )}
      </div>}
      {d.error && <p className="t-body-sm" style={{ color: 'var(--danger)' }} role="alert">{d.error}</p>}
    </>
  );
  if (given) return <div className="bgv-stack">{body}</div>;

  return (
    <Card title="شخصی‌سازی پروفایل" aria-label="شخصی‌سازی پروفایل" data-tour="profile-editor">
      <div className="bgv-stack">
        <Tabs label="بخش‌های شخصی‌سازی" value={tab} onChange={(v) => setTab(v as EditorTab)} items={[
          { value: 'about', label: 'معرفی و لقب' }, { value: 'banner', label: 'بنر' }, { value: 'fav', label: 'بازی‌های محبوب' }, { value: 'showcase', label: 'ویترین' }
        ]} />
        {body}
        {d.dirty > 0 && (
          <div className="pf-savebar" role="status">
            <span>{faNum(d.dirty)} تغییر ذخیره‌نشده</span>
            <span className="bgv-spacer" />
            <Button variant="ghost" onClick={d.reset}>انصراف</Button>
            <Button variant="primary" loading={d.busy} onClick={d.save}>ذخیرهٔ همه</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
