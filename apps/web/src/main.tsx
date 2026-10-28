import './app.css';
import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '@bg/ui';
import { Button, StateBlock } from '@bg/ui/bgv';
import { PrefsProvider } from './lib/prefs.tsx';
import { SessionProvider, useSession } from './lib/session.tsx';
import { Layout } from './shell/Layout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Catalog } from './pages/Catalog.tsx';
import { Login } from './pages/Login.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { RealtimeProvider } from './lib/realtime.tsx';
import { SITE_LINKS, SitePage } from './pages/SitePage.tsx';

/** The design showcase is an internal tool: admins only (the server enforces nothing here; the page holds no data). */
function AdminOnly({ children }: { children: ReactNode }) {
  const { me, status } = useSession();
  if (status === 'loading') return <StateBlock kind="loading" title="در حال بررسی دسترسی…" />;
  if (!me) return <StateBlock kind="denied" title="ابتدا وارد شوید" action={<Button variant="primary" href="/login?next=/design">ورود</Button>} />;
  if (!me.roles.includes('admin')) return <StateBlock kind="denied" title="دسترسی ندارید" text="این بخش فقط برای مدیر محصول است." />;
  return <>{children}</>;
}

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
const SearchPage = lazy(() => import('./pages/Search.tsx').then((m) => ({ default: m.SearchPage })));
const MorePage = lazy(() => import('./pages/More.tsx').then((m) => ({ default: m.MorePage })));
const ProgressPage = lazy(() => import('./pages/Progress.tsx').then((m) => ({ default: m.ProgressPage })));
const RankingPage = lazy(() => import('./pages/Ranking.tsx').then((m) => ({ default: m.RankingPage })));
const DevGatewayPage = lazy(() => import('./pages/Plans.tsx').then((m) => ({ default: m.DevGatewayPage })));
const PaymentResultPage = lazy(() => import('./pages/Plans.tsx').then((m) => ({ default: m.PaymentResultPage })));
const PlansPage = lazy(() => import('./pages/Plans.tsx').then((m) => ({ default: m.PlansPage })));
const AvatarBuilder = lazy(() => import('./pages/AvatarBuilder.tsx').then((m) => ({ default: m.AvatarBuilder })));
const TournamentsPage = lazy(() => import('./pages/Tournaments.tsx').then((m) => ({ default: m.TournamentsPage })));
const TournamentPage = lazy(() => import('./pages/Tournaments.tsx').then((m) => ({ default: m.TournamentPage })));
const WikiPage = lazy(() => import('./pages/Wiki.tsx').then((m) => ({ default: m.WikiPage })));
const MyProfile = lazy(() => import('./pages/MyProfile.tsx').then((m) => ({ default: m.MyProfile })));
const GuidesPage = lazy(() => import('./pages/Guides.tsx').then((m) => ({ default: m.GuidesPage })));
const MyTablesPage = lazy(() => import('./pages/MyTables.tsx').then((m) => ({ default: m.MyTablesPage })));
const NotificationsPage = lazy(() => import('./pages/Notifications.tsx').then((m) => ({ default: m.NotificationsPage })));
const CoinsPage = lazy(() => import('./pages/Coins.tsx').then((m) => ({ default: m.CoinsPage })));
const ShopPage = lazy(() => import('./pages/Shop.tsx').then((m) => ({ default: m.ShopPage })));
const WardrobePage = lazy(() => import('./pages/Wardrobe.tsx').then((m) => ({ default: m.WardrobePage })));
const StudioPage = lazy(() => import('./pages/Studio.tsx').then((m) => ({ default: m.StudioPage })));

// Friend invite link (?ref=CODE): remembered until sign-up, whichever page the visitor lands on.
const ref = new URLSearchParams(location.search).get('ref');
if (ref) try { localStorage.setItem('bg_ref', ref); } catch { /* storage blocked: the link still works if they log in now */ }

const router = createBrowserRouter([
  {
    element: <Suspense fallback={<StateBlock kind="loading" title="در حال بارگذاری…" />}><Layout /></Suspense>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'games', element: <Catalog /> },
      { path: 'games/:id', element: <GameDetailPage /> },
      { path: 'wiki', element: <WikiPage /> },
      { path: 'games/:id/new', element: <CreateTable /> },
      { path: 'tables', element: <OpenTables /> },
      { path: 'tables/mine', element: <MyTablesPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
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
      { path: 'guides', element: <GuidesPage /> },
      ...SITE_LINKS.map(([slug]) => ({ path: slug, element: <SitePage key={slug} slug={slug} /> })),
      { path: 'mod', element: <ModerationPage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'ranking', element: <RankingPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'coins', element: <CoinsPage /> },
      { path: 'tournaments', element: <TournamentsPage /> },
      { path: 'tournaments/:id', element: <TournamentPage /> },
      { path: 'me/avatar', element: <AvatarBuilder /> },
      { path: 'me/profile', element: <MyProfile /> },
      { path: 'me/studio', element: <StudioPage /> },
      { path: 'me/wardrobe', element: <WardrobePage /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'payments/result', element: <PaymentResultPage /> },
      { path: 'dev-gateway', element: <DevGatewayPage /> },
      { path: 'login', element: <Login /> },
      { path: 'settings', element: <Settings /> },
      { path: 'design', element: <AdminOnly><Showcase /></AdminOnly> },
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
