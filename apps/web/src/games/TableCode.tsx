import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Icon, StateBlock } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';

/** «کد میز داری؟» (DS v2.4 T-join): a short table code opens /t/<code>. */
export function TableCodeForm({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const clean = code.trim().toUpperCase();
  return (
    <form className={`T-join ${className}`.trim()} role="search" aria-label="ورود با کد میز"
      onSubmit={(e) => { e.preventDefault(); if (/^[A-Z0-9]{6,8}$/.test(clean)) navigate(`/t/${clean}`); }}>
      <span className="T-join__ic"><Icon name="hash" /></span>
      <label htmlFor="tcode">کد میز داری؟</label>
      <input id="tcode" name="code" placeholder="مثلاً K7Q2MX" dir="ltr" autoComplete="off" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
      <Button type="submit" variant="secondary" size="sm" disabled={!/^[A-Z0-9]{6,8}$/.test(clean)}>برو سر میز</Button>
    </form>
  );
}

/** /t/<code>: resolves the short code and opens the table (a private table only for its own players). */
export function TableCodePage() {
  const { code = '' } = useParams();
  usePageTitle(`میز ${code.toUpperCase()}`);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ id: string }>(`/t/${encodeURIComponent(code)}`)
      .then((r) => { if (live) navigate(`/tables/${r.id}${location.search}`, { replace: true }); })
      .catch((e) => { if (live) setError(e instanceof ApiFailure && e.status === 404 ? 'میزی با این کد پیدا نشد.' : 'ارتباط با سرور برقرار نشد.'); });
    return () => { live = false; };
  }, [code, navigate]);
  if (error) return <StateBlock kind="empty" title={error} text="کد را دوباره بررسی کنید؛ میزهای خصوصی فقط با لینک دعوت باز می‌شوند." action={<Button href="/tables">میزهای باز</Button>} />;
  return <StateBlock kind="loading" title="در حال باز کردن میز…" />;
}
