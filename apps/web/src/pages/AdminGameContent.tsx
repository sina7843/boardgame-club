// Admin: the game page content (DS v2.4 GameDetail blocks). Lists are edited one item per line with «|» between the
// parts, so the whole page fits one form; the server validates with the same schema (contracts gameContent).
import { useEffect, useState } from 'react';
import { emptyGameContent, type GameContent } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Button, Card, Icon, StateBlock, TextField, Textarea } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';

const pairs = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [a = '', ...rest] = l.split('|');
  return [a.trim(), rest.join('|').trim()] as const;
});
const lines = <T,>(list: T[], f: (x: T) => string) => list.map(f).join('\n');
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))));

interface Form {
  about: string; highlights: string; moves: string; screenshots: string; faq: string;
  weight: string; bestPlayers: string; minAge: string; mechanics: string; themes: string;
  designer: string; artist: string; publisher: string; publisherFa: string; year: string;
}

function toForm(c: GameContent): Form {
  const s = c.sheet;
  return {
    about: c.aboutFa.join('\n\n'), highlights: lines(c.highlights, (h) => `${h.titleFa} | ${h.textFa}`),
    moves: lines(c.moves, (m) => (m.noteFa ? `${m.labelFa} | ${m.noteFa}` : m.labelFa)),
    screenshots: lines(c.screenshots, (x) => `${x.src} | ${x.captionFa}`), faq: lines(c.faq, (f) => `${f.qFa} | ${f.aFa}`),
    weight: s.weight === null ? '' : String(s.weight), bestPlayers: s.bestPlayersFa, minAge: s.minAge === null ? '' : String(s.minAge),
    mechanics: lines(s.mechanics, (t) => (t.en ? `${t.fa} | ${t.en}` : t.fa)), themes: lines(s.themes, (t) => (t.en ? `${t.fa} | ${t.en}` : t.fa)),
    designer: s.designer, artist: s.artist, publisher: s.publisher, publisherFa: s.publisherFa, year: s.year === null ? '' : String(s.year)
  };
}

function toContent(f: Form): GameContent {
  return {
    aboutFa: f.about.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    highlights: pairs(f.highlights).map(([titleFa, textFa]) => ({ titleFa, textFa })),
    moves: pairs(f.moves).map(([labelFa, noteFa]) => (noteFa ? { labelFa, noteFa } : { labelFa })),
    screenshots: pairs(f.screenshots).map(([src, captionFa]) => ({ src, captionFa })),
    faq: pairs(f.faq).map(([qFa, aFa]) => ({ qFa, aFa })),
    sheet: {
      weight: num(f.weight), bestPlayersFa: f.bestPlayers.trim(), minAge: num(f.minAge),
      mechanics: pairs(f.mechanics).map(([fa, en]) => ({ fa, en })), themes: pairs(f.themes).map(([fa, en]) => ({ fa, en })),
      designer: f.designer.trim(), artist: f.artist.trim(), publisher: f.publisher.trim(), publisherFa: f.publisherFa.trim(), year: num(f.year)
    }
  };
}

export function GameContentAdmin({ gameId }: { gameId: string }) {
  const toast = useToast();
  const loaded = useApi<GameContent>(`/games/${encodeURIComponent(gameId)}/content`);
  const [form, setForm] = useState<Form>(() => toForm(emptyGameContent()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { if (loaded.data) setForm(toForm(loaded.data)); }, [loaded.data]);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setBusy(true); setError(undefined);
    try { setForm(toForm(await api<GameContent>(`/admin/games/${gameId}/content`, { method: 'PUT', body: toContent(form) }))); toast('success', 'محتوای صفحهٔ بازی ذخیره شد.'); }
    catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'ذخیره نشد.'); }
    finally { setBusy(false); }
  };
  if (loaded.error) return <Card><StateBlock kind="error" title="محتوا بارگذاری نشد" action={<Button variant="primary" icon="refresh-cw" onClick={loaded.reload}>تلاش دوباره</Button>} /></Card>;
  return (
    <Card className="ac-sec" aria-labelledby="admin-content-h">
      <div className="ac-sec__head"><span className="ac-tile"><Icon name="book-open" /></span><h2 id="admin-content-h" className="ac-h3">محتوای صفحهٔ بازی</h2></div>
      <p className="ac-cap ac-pad">در فهرست‌ها هر مورد یک خط است و بخش‌ها با «|» جدا می‌شوند. تصویرها باید در پوشهٔ سایت باشند (مثلاً <bdi dir="ltr">/games/{gameId}/table.webp</bdi>).</p>
      <div className="ac-pad" style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <Textarea label="درباره (پاراگراف‌ها با یک خط خالی جدا)" rows={5} value={form.about} onChange={set('about')} />
        <Textarea label="نکته‌های کنار متن: عنوان | توضیح" rows={3} value={form.highlights} onChange={set('highlights')} />
        <Textarea label="حرکت‌های اصلی: برچسب | یادداشت کوتاه (اختیاری)" rows={3} value={form.moves} onChange={set('moves')} />
        <Textarea label="تصویرها: مسیر | توضیح" rows={3} value={form.screenshots} onChange={set('screenshots')} />
        <Textarea label="سوال‌های رایج: سوال | جواب" rows={4} value={form.faq} onChange={set('faq')} />
        <div className="ac-grid2">
          <TextField label="سنگینی (۱ تا ۵)" inputMode="decimal" value={form.weight} onChange={set('weight')} />
          <TextField label="بهترین تعداد نفر" placeholder="مثلاً ۳ تا ۴ نفر" value={form.bestPlayers} onChange={set('bestPlayers')} />
          <TextField label="حداقل سن" inputMode="numeric" value={form.minAge} onChange={set('minAge')} />
          <TextField label="سال انتشار" inputMode="numeric" value={form.year} onChange={set('year')} />
          <TextField label="طراح" value={form.designer} onChange={set('designer')} />
          <TextField label="تصویرگری" value={form.artist} onChange={set('artist')} />
          <TextField label="ناشر" value={form.publisher} onChange={set('publisher')} />
          <TextField label="ناشر فارسی" value={form.publisherFa} onChange={set('publisherFa')} />
        </div>
        <Textarea label="سازوکارها: فارسی | English" rows={3} value={form.mechanics} onChange={set('mechanics')} />
        <Textarea label="دسته‌ها: فارسی | English" rows={3} value={form.themes} onChange={set('themes')} />
        {error && <p className="bgv-hint bgv-hint--error" role="alert">{error}</p>}
        <div><Button variant="primary" icon="check" loading={busy} onClick={save}>ذخیرهٔ محتوا</Button></div>
      </div>
    </Card>
  );
}
