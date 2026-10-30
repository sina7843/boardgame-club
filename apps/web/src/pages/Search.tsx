import { useNavigate } from 'react-router';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { HeaderSearch } from '../shell/SiteChrome.tsx';

/** Phone: the top bar's magnifier opens the design system's full-screen search sheet. */
export function SearchPage() {
  usePageTitle('جست‌وجو');
  const navigate = useNavigate();
  // Opened directly (no page of ours behind it): «بستن» goes home instead of leaving the site.
  return <HeaderSearch sheet onClose={() => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/'))} />;
}
