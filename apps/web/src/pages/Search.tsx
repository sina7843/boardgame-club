import { useNavigate } from 'react-router';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { HeaderSearch } from '../shell/SiteChrome.tsx';

/** Phone: the top bar's magnifier opens the design system's full-screen search sheet. */
export function SearchPage() {
  usePageTitle('جست‌وجو');
  const navigate = useNavigate();
  return <HeaderSearch sheet onClose={() => navigate(-1)} />;
}
