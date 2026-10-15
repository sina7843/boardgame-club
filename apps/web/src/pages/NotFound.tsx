import { useEffect } from 'react';
import { Button } from '@bg/ui/bgv';
import { usePageTitle } from '../lib/usePageTitle.ts';

export function NotFound() {
  usePageTitle('صفحه پیدا نشد');
  // The server answers every unknown path with the app shell (200), so tell crawlers not to index it.
  useEffect(() => {
    const meta = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' });
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  return (
    <div className="ac-404" role="status">
      <div className="bgv-felt" aria-hidden="true">
        <span className="ac-404__tile" style={{ transform: 'rotate(-6deg)' }}>۴</span>
        <span className="ac-404__tile" style={{ transform: 'translateY(-8px)' }}>۰</span>
        <span className="ac-404__tile" style={{ transform: 'rotate(5deg)' }}>۴</span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 className="t-page-sm">این صفحه پیدا نشد</h1>
        <p className="t-body-sm bgv-muted">نشانی را بررسی کنید؛ شاید میزی که دنبالش هستید بسته شده.</p>
      </div>
      <Button variant="primary" size="lg" icon="house" href="/" style={{ inlineSize: '100%' }}>بازگشت به خانه</Button>
      <Button variant="secondary" icon="search" href="/games">جست‌وجوی بازی</Button>
    </div>
  );
}
