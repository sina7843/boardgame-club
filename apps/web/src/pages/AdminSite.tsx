import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button, Input, Segmented, StateBlock, Textarea, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { jalaliDate } from '../lib/format.ts';
import { SITE_LINKS, SiteBody, type SiteInfo, type SiteSlug } from './SitePage.tsx';

const INFO_FIELDS: [keyof SiteInfo, string, boolean?][] = [
  ['ownerName', 'نام صاحب سایت (حقیقی یا حقوقی)'], ['email', 'ایمیل', true], ['phone', 'تلفن', true],
  ['address', 'نشانی پستی'], ['postalCode', 'کد پستی', true], ['hours', 'ساعت پاسخ‌گویی']
];

function useSave() {
  const toast = useToast();
  return async (path: string, method: 'PUT' | 'DELETE', body?: object) => {
    try { await api(path, { method, body }); toast('success', 'ذخیره شد.'); return true; }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); return false; }
  };
}

/** Contact details shown on «تماس با ما»; an empty field is hidden on the public page. */
function SiteInfoAdmin() {
  const s = useApi<SiteInfo>('/site/info');
  const save = useSave();
  const [draft, setDraft] = useState<SiteInfo>();
  useEffect(() => { if (s.data) setDraft(s.data); }, [s.data]);
  if (!draft) return null;
  return (
    <section className="panel stack" aria-labelledby="site-info-h">
      <h2 id="site-info-h" className="section-title">اطلاعات تماس</h2>
      <p className="muted" style={{ margin: 0 }}>در صفحهٔ «تماس با ما» نمایش داده می‌شود؛ فیلد خالی نمایش داده نمی‌شود.</p>
      <div className="site-admin__grid">{INFO_FIELDS.map(([k, label, ltr]) => (
        <Input key={k} label={label} value={draft[k]} dir={ltr ? 'ltr' : undefined} className={ltr ? 'input--ltr' : undefined}
          onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
      ))}</div>
      <div><Button size="sm" onClick={async () => { if (await save('/admin/site/info', 'PUT', draft)) s.reload(); }}>ذخیرهٔ اطلاعات تماس</Button></div>
    </section>
  );
}

function PageEditor({ slug }: { slug: SiteSlug }) {
  const p = useApi<{ titleFa: string; bodyFa: string; updatedAt: string | null }>(`/site/pages/${slug}`);
  const save = useSave();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [reaccept, setReaccept] = useState(false);
  const legal = slug === 'terms' || slug === 'privacy';
  useEffect(() => { if (p.data) { setTitle(p.data.titleFa); setBody(p.data.bodyFa); } }, [p.data]);
  if (p.error) return <StateBlock kind="error" title="بارگذاری نشد" action={<Button onClick={p.reload}>تلاش دوباره</Button>}>{p.error.messageFa}</StateBlock>;
  if (!p.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const dirty = title !== p.data.titleFa || body !== p.data.bodyFa;
  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        {p.data.updatedAt ? `آخرین ویرایش: ${jalaliDate(p.data.updatedAt)}` : 'متن پیش‌فرض (هنوز ویرایش نشده)'} · <Link to={`/${slug}`} target="_blank">مشاهدهٔ صفحه</Link>
      </p>
      <Input label="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
      {preview ? <div className="site-page panel"><SiteBody text={body} /></div>
        : <Textarea label="متن" rows={18} value={body} onChange={(e) => setBody(e.target.value)}
            hint="خط خالی = پاراگراف جدید · «## » اول خط = تیتر · «- » اول خط = مورد فهرست" />}
      {legal && (
        <label className="row" style={{ gap: '0.5rem' }}>
          <input type="checkbox" checked={reaccept} onChange={(e) => setReaccept(e.target.checked)} />
          <span>تغییر مهم است؛ همهٔ کاربران دوباره قوانین را بپذیرند (هنگام ورود بعدی پنجرهٔ پذیرش نشان داده می‌شود)</span>
        </label>
      )}
      <div className="row">
        <Button size="sm" disabled={!dirty} onClick={async () => { if (await save(`/admin/site/pages/${slug}`, 'PUT', { titleFa: title, bodyFa: body, requireReaccept: legal && reaccept })) { setReaccept(false); p.reload(); } }}>ذخیره</Button>
        <Button size="sm" variant="secondary" onClick={() => setPreview(!preview)}>{preview ? 'ویرایش' : 'پیش‌نمایش'}</Button>
        {dirty && <Button size="sm" variant="ghost" onClick={() => { setTitle(p.data!.titleFa); setBody(p.data!.bodyFa); }}>لغو تغییرات</Button>}
        {p.data.updatedAt && <Button size="sm" variant="ghost" onClick={async () => { if (await save(`/admin/site/pages/${slug}`, 'DELETE')) p.reload(); }}>بازگشت به متن پیش‌فرض</Button>}
      </div>
    </div>
  );
}

/** Admin tab: contact details plus the text of about/contact/terms/privacy/refund pages. */
export function SiteAdmin() {
  const [slug, setSlug] = useState<SiteSlug>('terms');
  return (
    <>
      <SiteInfoAdmin />
      <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="site-pages-h">
        <h2 id="site-pages-h" className="section-title">صفحه‌های سایت</h2>
        <Segmented legend="صفحه" name="site-page" value={slug} onChange={setSlug} options={SITE_LINKS.map(([value, label]) => ({ value, label }))} />
        <PageEditor key={slug} slug={slug} />
      </section>
    </>
  );
}
