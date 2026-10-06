import '@fontsource-variable/estedad/index.css';
import '@bg/ui/tokens.css';
import '@bg/ui/components.css';
import '@bg/ui/motion.css';
import './styles.css';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { StateBlock, ToastProvider } from '@bg/ui';
import { PrefsProvider } from './lib/prefs.tsx';
import { SessionProvider } from './lib/session.tsx';
import { Layout } from './shell/Layout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Catalog } from './pages/Catalog.tsx';
import { Login } from './pages/Login.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { RealtimeProvider } from './lib/realtime.tsx';

// Route-level code splitting: the shell, dashboard, catalog and login load first; everything else on demand.
const GameDetailPage = lazy(() => import('./pages/GameDetail.tsx').then((m) => ({ default: m.GameDetailPage })));
const Settings = lazy(() => import('./pages/Settings.tsx').then((m) => ({ default: m.Settings })));
const Showcase = lazy(() => import('./pages/Showcase.tsx').then((m) => ({ default: m.Showcase })));
const Admin = lazy(() => import('./pages/Admin.tsx').then((m) => ({ default: m.Admin })));
const CreateTable = lazy(() => import('./pages/CreateTable.tsx').then((m) => ({ default: m.CreateTable })));
const OpenTables = lazy(() => import('./pages/OpenTables.tsx').then((m) => ({ default: m.OpenTables })));
const TablePage = lazy(() => import('./pages/Table.tsx').then((m) => ({ default: m.TablePage })));
const QuickMatch = lazy(() => import('./pages/QuickMatch.tsx').then((m) => ({ default: m.QuickMatch })));
const FriendsPage = lazy(() => import('./pages/People.tsx').then((m) => ({ default: m.FriendsPage })));
const ProfilePage = lazy(() => import('./pages/People.tsx').then((m) => ({ default: m.ProfilePage })));
const ConversationPage = lazy(() => import('./pages/Messages.tsx').then((m) => ({ default: m.ConversationPage })));
const MessagesPage = lazy(() => import('./pages/Messages.tsx').then((m) => ({ default: m.MessagesPage })));
const ClubPage = lazy(() => import('./pages/Communities.tsx').then((m) => ({ default: m.ClubPage })));
const ClubsPage = lazy(() => import('./pages/Communities.tsx').then((m) => ({ default: m.ClubsPage })));
const GroupPage = lazy(() => import('./pages/Communities.tsx').then((m) => ({ default: m.GroupPage })));
const GroupsPage = lazy(() => import('./pages/Communities.tsx').then((m) => ({ default: m.GroupsPage })));
const SupportPage = lazy(() => import('./pages/Support.tsx').then((m) => ({ default: m.SupportPage })));
const ModerationPage = lazy(() => import('./pages/Moderation.tsx').then((m) => ({ default: m.ModerationPage })));
const MorePage = lazy(() => import('./pages/More.tsx').then((m) => ({ default: m.MorePage })));
const ProgressPage = lazy(() => import('./pages/Progress.tsx').then((m) => ({ default: m.ProgressPage })));
const RankingPage = lazy(() => import('./pages/Ranking.tsx').then((m) => ({ default: m.RankingPage })));
const DevGatewayPage = lazy(() => import('./pages/Plans.tsx').then((m) => ({ default: m.DevGatewayPage })));
const PaymentResultPage = lazy(() => import('./pages/Plans.tsx').then((m) => ({ default: m.PaymentResultPage })));
const PlansPage = lazy(() => import('./pages/Plans.tsx').then((m) => ({ default: m.PlansPage })));

const router = createBrowserRouter([
  {
    element: <Suspense fallback={<StateBlock kind="loading" title="در حال بارگذاری…" />}><Layout /></Suspense>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'games', element: <Catalog /> },
      { path: 'games/:id', element: <GameDetailPage /> },
      { path: 'games/:id/new', element: <CreateTable /> },
      { path: 'tables', element: <OpenTables /> },
      { path: 'tables/:id', element: <TablePage /> },
      { path: 'play', element: <QuickMatch /> },
      { path: 'friends', element: <FriendsPage /> },
      { path: 'users/:id', element: <ProfilePage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'messages/:id', element: <ConversationPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'groups/:id', element: <GroupPage /> },
      { path: 'clubs', element: <ClubsPage /> },
      { path: 'clubs/:slug', element: <ClubPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'mod', element: <ModerationPage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'ranking', element: <RankingPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'payments/result', element: <PaymentResultPage /> },
      { path: 'dev-gateway', element: <DevGatewayPage /> },
      { path: 'login', element: <Login /> },
      { path: 'settings', element: <Settings /> },
      { path: 'design', element: <Showcase /> },
      { path: 'admin', element: <Admin /> },
      { path: '*', element: <NotFound /> }
    ]
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrefsProvider>
      <SessionProvider>
        <ToastProvider>
          <RealtimeProvider>
            <RouterProvider router={router} />
          </RealtimeProvider>
        </ToastProvider>
      </SessionProvider>
    </PrefsProvider>
  </StrictMode>
);
