import { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { bioSchema, slotItems, unlockFa, type Me, type TrophyTier } from '@bg/contracts';
import { Button, Select, Textarea, cn, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';

interface Owned { unlocked: string[]; achievements: Record<string, string> }
const MAX_FAV = 3;
const MAX_SHOWCASE = 5;
const TITLES = slotItems('t').slice(1);

/** Title, banner, bio, favourite games and trophy showcase. Locked options are shown with how to unlock them. */
export function ProfileEditor({ me }: { me: Me }) {
  const { setMe } = useSession();
  const toast = useToast();
  const owned = useApi<Owned>('/me/cosmetics');
  const gamesApi = useApi<{ items: { id: string; nameFa: string }[] }>('/games');
  const ach = useApi<{ items: { key: string; titleFa: string; tier: TrophyTier }[] }>(`/users/${me.id}/achievements`);
  const [bio, setBio] = useState(me.bio ?? '');
  const [titleKey, setTitle] = useState(me.titleKey);
  const [bannerKey, setBanner] = useState(me.bannerKey);
  const [fav, setFav] = useState(me.favoriteGames);
  const [showcase, setShowcase] = useState(me.showcase);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBio(me.bio ?? ''); setTitle(me.titleKey); setBanner(me.bannerKey); setFav(me.favoriteGames); setShowcase(me.showcase); }, [me]);
  const unlocked = useMemo(() => new Set(owned.data?.unlocked ?? []), [owned.data]);
  const reason = (u: Parameters<typeof unlockFa>[0]) => unlockFa(u, (k) => owned.data?.achievements[k]);

  const toggle = (list: string[], set: (l: string[]) => void, k: string, max: number) =>
    set(list.includes(k) ? list.filter((x) => x !== k) : list.length < max ? [...list, k] : list);
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

  return (
    <section className="panel stack" aria-labelledby="custom-h">
      <h2 id="custom-h" className="section-title">شخصی‌سازی پروفایل</h2>
      <Textarea label="معرفی کوتاه" rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="مثلاً: عاشق کاتان، شب‌ها آنلاینم"
        hint={`${faNum(bio.length)} از ۱۶۰ نویسه · برای همه دیده می‌شود`} />

      <Select label="لقب" value={titleKey ?? ''} onChange={(e) => setTitle(e.target.value || null)}
        options={[{ value: '', label: 'بدون لقب' }, ...TITLES.filter((t) => unlocked.has(t.key)).map((t) => ({ value: t.key, label: t.nameFa }))]} />
      {TITLES.some((t) => !unlocked.has(t.key)) && (
        <p className="muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
          لقب‌های قفل: {TITLES.filter((t) => !unlocked.has(t.key)).map((t) => `${t.nameFa} (${reason(t.unlock)})`).join('، ')}
        </p>
      )}

      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: '0.5rem' }}>
        <legend className="field__label">بنر پروفایل</legend>
        <div className="banner-picker">
          {slotItems('bn').map((b) => {
            const locked = !unlocked.has(b.key);
            const on = (bannerKey ?? 'bn.0') === b.key;
            return (
              <button key={b.key} type="button" aria-pressed={on} disabled={locked} title={locked ? `${b.nameFa} — ${reason(b.unlock)}` : b.nameFa}
                className={cn('banner-picker__item', on && 'banner-picker__item--on')} onClick={() => setBanner(b.key === 'bn.0' ? null : b.key)}>
                <span className="banner-picker__swatch" style={{ background: b.css }}>{locked && <Lock className="size-4" aria-hidden />}</span>
                <span className="text-xs">{b.nameFa}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: '0.5rem' }}>
        <legend className="field__label">بازی‌های محبوب (تا {faNum(MAX_FAV)} بازی)</legend>
        {gamesApi.data ? (
          <div className="flex flex-wrap gap-2">
            {gamesApi.data.items.map((g) => (
              <button key={g.id} type="button" aria-pressed={fav.includes(g.id)} className={cn('chip', fav.includes(g.id) && 'chip--on')}
                disabled={!fav.includes(g.id) && fav.length >= MAX_FAV} onClick={() => toggle(fav, setFav, g.id, MAX_FAV)}>{g.nameFa}</button>
            ))}
          </div>
        ) : <p className="muted" role="status">در حال بارگذاری…</p>}
      </fieldset>

      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: '0.5rem' }}>
        <legend className="field__label">ویترین جام‌ها (تا {faNum(MAX_SHOWCASE)} جام، اول نمایش داده می‌شوند)</legend>
        {!ach.data ? <p className="muted" role="status">در حال بارگذاری…</p>
          : ach.data.items.length === 0 ? <p className="muted" style={{ margin: 0 }}>هنوز جامی ندارید؛ با بازی کردن دستاورد بگیرید.</p>
          : (
            <div className="flex flex-wrap gap-2">
              {ach.data.items.map((a) => (
                <button key={a.key} type="button" aria-pressed={showcase.includes(a.key)} className={cn('chip', `tier--${a.tier}`, showcase.includes(a.key) && 'chip--on')}
                  disabled={!showcase.includes(a.key) && showcase.length >= MAX_SHOWCASE} onClick={() => toggle(showcase, setShowcase, a.key, MAX_SHOWCASE)}>{a.titleFa}</button>
              ))}
            </div>
          )}
      </fieldset>

      {error && <p className="field__error" role="alert">{error}</p>}
      <div><Button busy={busy} onClick={save}>ذخیره شخصی‌سازی</Button></div>
    </section>
  );
}
