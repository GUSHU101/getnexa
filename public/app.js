import { h, render, route, state, toast } from './core.js';
import { initMusic } from './music-player.js';
import { initFirebase } from './firebase.js';
import { HomePage } from './pages/home.js';
import { GamesPage, GamePage } from './pages/games.js';
import { LoginPage, SignupPage, AccountPage } from './pages/account.js';
import { ShopPage, CheckoutPage } from './pages/shop.js';
import { LeaderboardsPage } from './pages/leaderboards.js';
import { StaticPage } from './pages/static.js';
import { TournamentsPage } from './pages/tournaments.js';
import { CreatorsPage } from './pages/creators.js';
import { GovernancePage } from './pages/governance.js';
import { ArenaPage } from './pages/arena.js';
import { BlogPage, BlogArticlePage } from './pages/blog.js';

const routes = [
  { path: '/',                view: HomePage },
  { path: '/games',           view: GamesPage },
  { path: '/games/:id',       view: GamePage },
  { path: '/login',           view: LoginPage },
  { path: '/signup',          view: SignupPage },
  { path: '/account',         view: AccountPage },
  { path: '/shop',            view: ShopPage },
  { path: '/checkout',        view: CheckoutPage },
  { path: '/leaderboards',    view: LeaderboardsPage },
  { path: '/leaderboards/:id',view: LeaderboardsPage },
  { path: '/tournaments',     view: TournamentsPage },
  { path: '/creators',        view: CreatorsPage },
  { path: '/governance',      view: GovernancePage },
  { path: '/arena',           view: ArenaPage },
  { path: '/blog',            view: BlogPage },
  { path: '/blog/:slug',      view: BlogArticlePage },
  { path: '/about',           view: () => StaticPage('about') },
  { path: '/privacy',         view: () => StaticPage('privacy') },
  { path: '/terms',           view: () => StaticPage('terms') },
  { path: '/contact',         view: () => StaticPage('contact') },
  { path: '/cookies',         view: () => StaticPage('cookies') },
];

window.addEventListener('popstate', () => render(routes));

(async function boot() {
  // pre-fetch current user + public config in parallel
  const [meRes, cfgRes] = await Promise.allSettled([
    fetch('/api/auth/me').then(r => r.json()),
    fetch('/api/config').then(r => r.json()),
  ]);
  state.user = meRes.status === 'fulfilled' ? (meRes.value.user || null) : null;
  if (cfgRes.status === 'fulfilled' && cfgRes.value.google_client_id) {
    state.googleClientId = cfgRes.value.google_client_id;
    // Pre-load Google Identity Services so sign-in button is instant
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }

  // Initialize Firebase (App + Analytics) — fail-safe, non-blocking
  initFirebase();

  // Initialize background music
  initMusic();

  render(routes);
})();

export { route, toast };
