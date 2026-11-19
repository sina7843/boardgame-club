// Build-time only (scripts/seo.ts): renders the guest home page to static HTML so the hero paints before the JS bundle
// runs (it is the LCP element on phones). The client still mounts with createRoot and renders the same markup over it.
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '@bg/ui';
import { PrefsProvider } from './lib/prefs.tsx';
import { SessionProvider } from './lib/session.tsx';
import { RealtimeProvider } from './lib/realtime.tsx';
import { Layout } from './shell/Layout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';

export function renderHome(): string {
  const router = createMemoryRouter([{ path: '/', element: <Layout />, children: [{ index: true, element: <Dashboard /> }] }], { initialEntries: ['/'] });
  return renderToString(
    <PrefsProvider>
      <SessionProvider>
        <ToastProvider>
          <RealtimeProvider>
            <RouterProvider router={router} />
          </RealtimeProvider>
        </ToastProvider>
      </SessionProvider>
    </PrefsProvider>
  );
}
