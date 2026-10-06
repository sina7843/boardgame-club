import { Link } from 'react-router';
import { StateBlock } from '@bg/ui';
import { usePageTitle } from '../lib/usePageTitle.ts';

export function NotFound() {
  usePageTitle('صفحه پیدا نشد');
  return (
    <StateBlock kind="empty" title="این صفحه پیدا نشد" action={<Link className="btn btn--primary" to="/">بازگشت به داشبورد</Link>}>
      نشانی را بررسی کنید.
    </StateBlock>
  );
}
