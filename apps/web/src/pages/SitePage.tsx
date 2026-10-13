import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, StateBlock } from '@bg/ui';
import { useApi } from '../lib/api.ts';
import { jalaliDate } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';

export type SiteSlug = 'about' | 'contact' | 'terms' | 'privacy' | 'refund';
export interface SiteInfo { ownerName: string; email: string; phone: string; address: string; postalCode: string; hours: string }
interface Page { slug: SiteSlug; titleFa: string; bodyFa: string; updatedAt: string | null }

export const SITE_LINKS: [SiteSlug, string][] = [['about', 'درباره ما'], ['contact', 'تماس با ما'], ['terms', 'قوانین و مقررات'], ['privacy', 'حریم خصوصی'], ['refund', 'قوانین خرید و بازگشت وجه']];

/** Admin-written text as React nodes (never HTML): blank line = paragraph, "## " = heading, "- " = bullet list. */
export function SiteBody({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((block, i) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const out: ReactNode[] = [];
    let list: string[] = [];
    const flush = (k: string) => { if (list.length) out.push(<ul key={k}>{list.map((x, j) => <li key={j}>{x}</li>)}</ul>); list = []; };
    lines.forEach((l, j) => {
      if (l.startsWith('- ')) { list.push(l.slice(2)); return; }
      flush(`u${j}`);
      out.push(l.startsWith('## ') ? <h2 key={j} className="section-title">{l.slice(3)}</h2> : <p key={j}>{l}</p>);
    });
    flush('u-end');
    return <div key={i} className="site-page__block">{out}</div>;
  })}</>;
}

function ContactInfo() {
  const info = useApi<SiteInfo>('/site/info').data;
  if (!info) return null;
  const rows: [string, string, string?][] = [
    ['نام', info.ownerName], ['ایمیل', info.email, info.email && `mailto:${info.email}`], ['تلفن', info.phone, info.phone && `tel:${info.phone.replace(/[^\d+]/g, '')}`],
    ['نشانی', info.address], ['کد پستی', info.postalCode], ['ساعت پاسخ‌گویی', info.hours]
  ];
  return (
    <dl className="site-page__contact panel">{rows.filter(([, v]) => v).map(([k, v, href]) => (
      <div key={k}><dt className="muted">{k}</dt><dd>{href ? <a href={href} dir="ltr"><bdi>{v}</bdi></a> : k === 'کد پستی' ? <bdi dir="ltr">{v}</bdi> : v}</dd></div>
    ))}</dl>
  );
}

export function SitePage({ slug }: { slug: SiteSlug }) {
  const page = useApi<Page>(`/site/pages/${slug}`);
  usePageTitle(page.data?.titleFa ?? SITE_LINKS.find(([s]) => s === slug)![1]);
  if (page.error) return <StateBlock kind="error" title="صفحه بارگذاری نشد" action={<Button onClick={page.reload}>تلاش دوباره</Button>}>{page.error.messageFa}</StateBlock>;
  if (!page.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  return (
    <article className="site-page">
      <div className="page-head"><div><h1 className="page-title">{page.data.titleFa}</h1>
        {page.data.updatedAt && <p className="page-sub">آخرین به‌روزرسانی: {jalaliDate(page.data.updatedAt)}</p>}</div></div>
      {slug === 'contact' && <ContactInfo />}
      <SiteBody text={page.data.bodyFa} />
      {slug === 'contact' && <p><Link className="btn btn--secondary" to="/support">ثبت درخواست در پشتیبانی</Link></p>}
    </article>
  );
}

/** Footer links to the site pages (the shell footer also carries the eNamad seal). */
export function SiteLinks() {
  return <nav aria-label="اطلاعات سایت" className="site-links">{SITE_LINKS.map(([s, label]) => <Link key={s} to={`/${s}`}>{label}</Link>)}</nav>;
}
