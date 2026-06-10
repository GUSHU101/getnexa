import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import {
  createStripeCheckoutSession,
  verifyStripeSignature,
  createPaypalOrder,
  capturePaypalOrder,
  type PayBindings,
} from './payments';

export { GameRoom } from './game-room';

type Bindings = PayBindings & {
  DB: D1Database;
  ASSETS: Fetcher;
  GAME_ROOM: DurableObjectNamespace;
  AI?: any;
  SITE_NAME: string;
  SITE_URL: string;
  DISCORD_WEBHOOK_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
};

type Variables = {
  userId?: number;
  username?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('/api/*', cors({ origin: (o) => o ?? '*', credentials: true }));

// Security headers + caching — wrap the response so headers are mutable
app.use('*', async (c, next) => {
  await next();
  const url = new URL(c.req.url);
  const headers = new Headers(c.res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (/\.(js|css|svg|webp|png|jpg|woff2?)$/.test(url.pathname)) {
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  }
  c.res = new Response(c.res.body, { status: c.res.status, statusText: c.res.statusText, headers });
});

// ---------- helpers ----------
const enc = new TextEncoder();

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = enc.encode(password + ':' + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const h = await hashPassword(password, salt);
  return h === hash;
}

async function makePasswordHash(password: string): Promise<string> {
  const salt = randomHex(8);
  const h = await hashPassword(password, salt);
  return `${salt}$${h}`;
}

async function getUserFromSession(c: any): Promise<any | null> {
  const token = getCookie(c, 'nexa_session');
  if (!token) return null;
  const now = Date.now();
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.tier, u.coins, u.xp, u.level, u.display_name, u.age_verified, u.date_of_birth
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`
  ).bind(token, now).first();
  return row;
}

async function requireAuth(c: any, next: any) {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('userId', user.id);
  c.set('username', user.username);
  (c as any).user = user;
  await next();
}

// ---------- health ----------
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now(), site: c.env.SITE_NAME }));

/** Catalog release queue; cron publishes one additional game every hour. */
const GAME_RELEASE_QUEUE = [
  'neondrift',
  'starblitz',
  'snake',
  '2048',
  'tetris',
  'memory',
  'breakout',
  'minesweeper',
  'tictactoe',
  'pong',
  'candy-crush',
  'pacman',
  'chess',
  'doodle-jump',
  'solitaire',
  'sudoku',
  'crossy-road',
  'rps',
  'flappy-bird',
  '2048-ext',
  'wordle',
  'hangman',
  'tower-blocks',
  'archery',
  'tictactoe-ext',
  'minesweeper-ext',
  'speed-typing',
  'breakout-ext',
  'ping-pong',
  'tetris-ext',
  'tilting-maze',
  'memory-ext',
  'number-guess',
  'snake-ext',
  'connect-four',
  'insect-catch',
  'typing-hero',
  'dice-roll',
  'shape-clicker',
  'typing-pro',
  'speak-guess',
  'fruit-slicer',
  'quiz',
  'emoji-catcher',
  'whack-a-mole',
  'simon-says',
  'sliding-puzzle',
  'balloon-pop',
  'color-flash',
  'math-blitz',
  'asteroid-dash',
  'bubble-pop',
  'reaction-test',
  'word-scramble',
  'tap-tiles',
] as const;

const HOME_PAGE_FEATURED_LIMIT = 8;

async function getPublishedCatalog(env: Bindings) {
  const grouped = await env.DB.prepare(
    `SELECT game_id, MIN(created_at) AS first_at FROM hourly_featured GROUP BY game_id ORDER BY first_at ASC`
  ).all<{ game_id: string; first_at: number }>();
  const latest = await env.DB.prepare('SELECT game_id, created_at FROM hourly_featured ORDER BY id DESC LIMIT 1').first<{
    game_id: string;
    created_at: number;
  }>();

  const order = (grouped.results || []).map((row) => row.game_id).filter((id) => GAME_RELEASE_QUEUE.includes(id as any));
  if (!order.length) order.push(GAME_RELEASE_QUEUE[0]);

  return {
    order,
    latestReleaseId: latest?.game_id ?? order[order.length - 1],
    latestReleaseAt: latest?.created_at ?? null,
    upcoming: GAME_RELEASE_QUEUE.filter((id) => !order.includes(id)),
  };
}

app.get('/api/catalog', async (c) => {
  const catalog = await getPublishedCatalog(c.env);
  return c.json({
    order: catalog.order,
    latestReleaseId: catalog.latestReleaseId,
    latestReleaseAt: catalog.latestReleaseAt,
    upcomingCount: catalog.upcoming.length,
  });
});

app.get('/api/home/featured', async (c) => {
  const catalog = await getPublishedCatalog(c.env);

  return c.json({
    order: catalog.order.slice(0, HOME_PAGE_FEATURED_LIMIT),
    highlightId: catalog.latestReleaseId,
    latestReleaseAt: catalog.latestReleaseAt,
    upcomingCount: catalog.upcoming.length,
  });
});

// ---------- auth ----------
app.post('/api/auth/signup', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = (body.username || '').toString().trim().toLowerCase();
  const email = (body.email || '').toString().trim().toLowerCase();
  const password = (body.password || '').toString();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) return c.json({ error: 'Username must be 3-20 chars, letters/numbers/underscore' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: 'Invalid email' }, 400);
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? OR email = ?').bind(username, email).first();
  if (existing) return c.json({ error: 'Username or email already taken' }, 409);

  const hash = await makePasswordHash(password);
  const now = Date.now();
  const res = await c.env.DB.prepare(
    'INSERT INTO users (username, email, password_hash, display_name, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(username, email, hash, username, now, now).run();
  const userId = res.meta.last_row_id as number;

  const token = randomHex(32);
  const expires = now + 1000 * 60 * 60 * 24 * 30;
  await c.env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, now, expires).run();

  setCookie(c, 'nexa_session', token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 30 });

  return c.json({ ok: true, user: { id: userId, username, email, tier: 'free', coins: 100, xp: 0, level: 1 } });
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const identifier = (body.identifier || body.username || body.email || '').toString().trim().toLowerCase();
  const password = (body.password || '').toString();

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .bind(identifier, identifier).first<any>();
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return c.json({ error: 'Invalid credentials' }, 401);

  const token = randomHex(32);
  const now = Date.now();
  const expires = now + 1000 * 60 * 60 * 24 * 30;
  await c.env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, user.id, now, expires).run();
  await c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, user.id).run();

  setCookie(c, 'nexa_session', token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 30 });

  return c.json({ ok: true, user: { id: user.id, username: user.username, email: user.email, tier: user.tier, coins: user.coins, xp: user.xp, level: user.level } });
});

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, 'nexa_session');
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  deleteCookie(c, 'nexa_session', { path: '/' });
  return c.json({ ok: true });
});

app.get('/api/auth/me', async (c) => {
  const user = await getUserFromSession(c);
  return c.json({ user: user || null });
});

// ---------- scores ----------
app.post('/api/scores', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const gameId = (body.game_id || '').toString();
  const score = parseInt(body.score, 10);
  if (!gameId || isNaN(score) || score < 0 || score > 1_000_000_000) return c.json({ error: 'Invalid score' }, 400);
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO scores (user_id, game_id, score, created_at) VALUES (?, ?, ?, ?)')
    .bind(user.id, gameId, score, now).run();

  const xpGained = Math.min(100, Math.floor(score / 10) + 5);
  const coinsGained = Math.min(50, Math.floor(score / 25) + 2);
  const newXp = user.xp + xpGained;
  const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 50)) + 1);
  await c.env.DB.prepare('UPDATE users SET xp = ?, level = ?, coins = coins + ? WHERE id = ?')
    .bind(newXp, newLevel, coinsGained, user.id).run();

  // Update any open tournament entries for this game+user
  await c.env.DB.prepare(
    `UPDATE tournament_entries
     SET best_score = MAX(best_score, ?)
     WHERE user_id = ? AND tournament_id IN (
        SELECT id FROM tournaments WHERE game_id = ? AND status = 'active' AND starts_at <= ? AND ends_at >= ?
     )`
  ).bind(score, user.id, gameId, now, now).run();

  return c.json({ ok: true, xpGained, coinsGained, newLevel });
});

app.get('/api/scores/leaderboard/:gameId', async (c) => {
  const gameId = c.req.param('gameId');
  const rows = await c.env.DB.prepare(
    `SELECT u.username, u.display_name, MAX(s.score) AS best_score
     FROM scores s JOIN users u ON u.id = s.user_id
     WHERE s.game_id = ?
     GROUP BY s.user_id ORDER BY best_score DESC LIMIT 25`
  ).bind(gameId).all();
  return c.json({ leaderboard: rows.results });
});

async function notifySentinel(env: Bindings, user: any, gameId: string, score: number) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🛰️ **NEXA SENTINEL ALERT**: Operative **${user.username}** has synchronized a record-breaking score of **${score.toLocaleString()}** in **${gameId}**! THE GRID IS EVOLVING.`
      })
    });
  } catch {}
}

async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`
  });
  const data = await res.json<any>();
  return !!data.success;
}

app.get('/api/scores/me/:gameId', requireAuth, async (c) => {
  const user = (c as any).user;
  const gameId = c.req.param('gameId');
  const row = await c.env.DB.prepare('SELECT MAX(score) AS best FROM scores WHERE user_id = ? AND game_id = ?')
    .bind(user.id, gameId).first<any>();
  return c.json({ best: row?.best ?? 0 });
});

app.post('/api/scores', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const gameId = body.game_id;
  const score = parseInt(body.score, 10);
  const turnstileToken = body.cf_turnstile_response;

  if (!gameId || isNaN(score)) return c.json({ error: 'invalid_data' }, 400);

  // Bot Protection: Turnstile is mandatory for scores > 1000 or any record-breaking attempt
  if (score > 1000 && c.env.TURNSTILE_SECRET_KEY) {
    const isHuman = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY);
    if (!isHuman) return c.json({ error: 'bot_detected', message: 'Neural scan failed. Are you human?' }, 403);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO scores (user_id, game_id, score, created_at) VALUES (?, ?, ?, ?)'
  ).bind(user.id, gameId, score, now).run();

  // Nexa Sentinel: Social Proof for High-Intensity Events
  if (score > 5000) {
    c.executionCtx.waitUntil(notifySentinel(c.env, user, gameId, score));
  }

  // Progression Logic: 1 XP per 10 points
  const xpGained = Math.floor(score / 10);
  if (xpGained > 0) {
    await c.env.DB.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(xpGained, user.id).run();
    
    // Check level up (Level = floor(sqrt(xp/100)) + 1)
    const updated = await c.env.DB.prepare('SELECT xp, level FROM users WHERE id = ?').bind(user.id).first<any>();
    const newLevel = Math.floor(Math.sqrt(updated.xp / 100)) + 1;
    if (newLevel > updated.level) {
      await c.env.DB.prepare('UPDATE users SET level = ?, coins = coins + ? WHERE id = ?')
        .bind(newLevel, newLevel * 100, user.id).run();
      return c.json({ ok: true, xp_gained: xpGained, leveled_up: true, new_level: newLevel });
    }
  }

  return c.json({ ok: true, xp_gained: xpGained });
});

// ---------- activity ----------
app.get('/api/activity/last', async (c) => {
  const row = await c.env.DB.prepare('SELECT u.username, u.avatar, s.game_id, s.score, s.created_at FROM scores s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1').first();
  return c.json({ last: row });
});

app.get('/api/leaderboards/global', async (c) => {
  const rows = await c.env.DB.prepare('SELECT username, avatar, xp, level FROM users ORDER BY xp DESC LIMIT 10').all();
  return c.json({ players: rows.results });
});

// ---------- game saves ----------
app.get('/api/saves/:gameId', requireAuth, async (c) => {
  const user = (c as any).user;
  const row = await c.env.DB.prepare('SELECT data, updated_at FROM game_saves WHERE user_id = ? AND game_id = ?')
    .bind(user.id, c.req.param('gameId')).first<any>();
  return c.json({ save: row ? JSON.parse(row.data) : null, updated_at: row?.updated_at ?? null });
});

app.post('/api/saves/:gameId', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const data = JSON.stringify(body.data ?? {}).slice(0, 20000);
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO game_saves (user_id, game_id, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, game_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).bind(user.id, c.req.param('gameId'), data, now).run();
  return c.json({ ok: true });
});

// ---------- profile ----------
app.get('/api/profile/:username', async (c) => {
  const username = c.req.param('username').toLowerCase();
  const user = await c.env.DB.prepare(
    'SELECT id, username, display_name, avatar, tier, xp, level, created_at FROM users WHERE username = ?'
  ).bind(username).first<any>();
  if (!user) return c.json({ error: 'not_found' }, 404);
  const scores = await c.env.DB.prepare(
    `SELECT game_id, MAX(score) AS best FROM scores WHERE user_id = ? GROUP BY game_id`
  ).bind(user.id).all();
  return c.json({ user, scores: scores.results });
});

app.patch('/api/profile', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const display = (body.display_name || '').toString().slice(0, 40);
  const avatar = (body.avatar || '').toString().slice(0, 200);
  await c.env.DB.prepare('UPDATE users SET display_name = ?, avatar = ? WHERE id = ?')
    .bind(display, avatar, user.id).run();
  return c.json({ ok: true });
});

// ---------- shop / products ----------
const PRODUCTS = [
  { id: 'coins_small', name: 'Coin Pack (500)', price_cents: 99, type: 'coins', amount: 500 },
  { id: 'coins_medium', name: 'Coin Pack (3,000)', price_cents: 499, type: 'coins', amount: 3000 },
  { id: 'coins_large', name: 'Coin Pack (10,000)', price_cents: 1499, type: 'coins', amount: 10000 },
  { id: 'coins_mega', name: 'Coin Pack (50,000)', price_cents: 4999, type: 'coins', amount: 50000 },
  { id: 'operative_tier', name: 'NEXA Operative (Monthly)', price_cents: 499, type: 'subscription', recurring: true },
  { id: 'pro_month', name: 'Nexa Pro (Monthly)', price_cents: 499, type: 'subscription', recurring: true },
  { id: 'pro_year', name: 'Nexa Pro (Annual)', price_cents: 4999, type: 'subscription', recurring: false },
  { id: 'legend_month', name: 'Nexa Legend (Monthly)', price_cents: 999, type: 'subscription', recurring: true },
  { id: 'starter_month', name: 'Nexa Starter', price_cents: 299, type: 'subscription', recurring: true, features: ['No ads', 'Custom avatars', 'Tournament access', '200 coins/month'] },
  { id: 'remove_ads_month', name: 'Remove Ads (Monthly)', price_cents: 299, type: 'subscription', recurring: true },
  { id: 'studio_creator', name: 'Nexa Studio - Creator Plan', price_cents: 1900, type: 'subscription', recurring: true },
  { id: 'theme_neon', name: 'Neon Theme Pack', price_cents: 199, type: 'cosmetic' },
  { id: 'theme_retro', name: 'Retro Theme Pack', price_cents: 199, type: 'cosmetic' },
  { id: 'avatar_frame_gold', name: 'Gold Avatar Frame', price_cents: 299, type: 'cosmetic' },
  { id: 'avatar_frame_diamond', name: 'Diamond Avatar Frame', price_cents: 499, type: 'cosmetic' },
  { id: 'boost_xp_24h', name: '2x XP Boost (24h)', price_cents: 149, type: 'consumable' },
  { id: 'boost_xp_7d', name: '2x XP Boost (7 days)', price_cents: 499, type: 'consumable' },
  { id: 'extra_life_pack', name: 'Extra Lives x10', price_cents: 99, type: 'consumable' },
  { id: 'outfit_starter_99', name: 'Starter Outfit Pack', price_cents: 99, type: 'cosmetic' },
  { id: 'hint_pack', name: 'Puzzle Hints x20', price_cents: 99, type: 'consumable' },
  { id: 'tournament_entry', name: 'Weekly Tournament Entry', price_cents: 199, type: 'entry' },
  { id: 'custom_room', name: 'Private Multiplayer Room', price_cents: 299, type: 'entry' },
  { id: 'tip_small', name: 'Tip the devs ($1)', price_cents: 100, type: 'tip' },
  { id: 'tip_medium', name: 'Tip the devs ($5)', price_cents: 500, type: 'tip' },
  { id: 'tip_large', name: 'Tip the devs ($20)', price_cents: 2000, type: 'tip' },
];

app.get('/api/shop/products', (c) => c.json({ products: PRODUCTS }));

app.post('/api/shop/spend-coins', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const itemId = (body.item_id || '').toString();
  const cost = parseInt(body.cost, 10);
  if (!itemId || isNaN(cost) || cost <= 0) return c.json({ error: 'Invalid' }, 400);
  if (user.coins < cost) return c.json({ error: 'Not enough coins' }, 402);
  const now = Date.now();
  await c.env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').bind(cost, user.id).run();
  await c.env.DB.prepare(
    `INSERT INTO inventory (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1`
  ).bind(user.id, itemId, now).run();
  return c.json({ ok: true, remaining_coins: user.coins - cost });
});

app.get('/api/inventory', requireAuth, async (c) => {
  const user = (c as any).user;
  const rows = await c.env.DB.prepare('SELECT item_id, quantity, acquired_at FROM inventory WHERE user_id = ?')
    .bind(user.id).all();
  return c.json({ inventory: rows.results });
});

app.post('/api/inventory/use', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const itemId = (body.item_id || '').toString();
  const amount = Math.max(1, parseInt(body.amount, 10) || 1);
  if (!itemId) return c.json({ error: 'Missing item_id' }, 400);

  const row = await c.env.DB.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
    .bind(user.id, itemId).first<{ quantity: number }>();
  const qty = row?.quantity ?? 0;
  if (qty < amount) return c.json({ error: 'Not enough inventory' }, 409);

  await c.env.DB.prepare('UPDATE inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?')
    .bind(amount, user.id, itemId).run();
  await c.env.DB.prepare('DELETE FROM inventory WHERE user_id = ? AND item_id = ? AND quantity <= 0')
    .bind(user.id, itemId).run();

  return c.json({ ok: true, item_id: itemId, remaining: qty - amount });
});

/* ─── Stripe Checkout ──────────────────────────── */
app.post('/api/pay/stripe/checkout', requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: 'Stripe not configured. Admin: wrangler secret put STRIPE_SECRET_KEY' }, 503);
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const product = PRODUCTS.find(p => p.id === body.product_id);
  if (!product) return c.json({ error: 'Unknown product' }, 400);

  const now = Date.now();
  const orderRes = await c.env.DB.prepare(
    'INSERT INTO purchases (user_id, product_id, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, product.id, product.price_cents, 'pending', now).run();
  const orderId = orderRes.meta.last_row_id as number;

  try {
    const session = await createStripeCheckoutSession(c.env, {
      productName: product.name,
      priceCents: product.price_cents,
      recurring: !!(product as any).recurring,
      successUrl: `${c.env.SITE_URL}/checkout?provider=stripe&status=success&order=${orderId}&sid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${c.env.SITE_URL}/checkout?provider=stripe&status=cancel&order=${orderId}`,
      userId: user.id,
      productId: product.id,
      metadata: { order_id: String(orderId) },
    });
    return c.json({ url: session.url, id: session.id, order_id: orderId });
  } catch (e: any) {
    return c.json({ error: e.message || 'Stripe error' }, 500);
  }
});

app.post('/api/pay/stripe/webhook', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) return c.json({ error: 'webhook_not_configured' }, 503);
  const raw = await c.req.text();
  const sig = c.req.header('stripe-signature');
  const ok = await verifyStripeSignature(raw, sig || null, c.env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return c.json({ error: 'invalid_signature' }, 400);

  let evt: any = {};
  try { evt = JSON.parse(raw); } catch {}
  if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') {
    const s = evt.data?.object || {};
    const orderId = parseInt(s.metadata?.order_id, 10);
    const userId = parseInt(s.metadata?.user_id, 10);
    const productId = s.metadata?.product_id;
    if (orderId) await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('completed', orderId).run();
    if (userId && productId) await fulfillProduct(c.env, userId, productId);
  }
  return c.json({ received: true });
});

/* ─── PayPal ──────────────────────────── */
app.post('/api/pay/paypal/create', requireAuth, async (c) => {
  if (!c.env.PAYPAL_CLIENT_ID) return c.json({ error: 'PayPal not configured. Admin: wrangler secret put PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET' }, 503);
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const product = PRODUCTS.find(p => p.id === body.product_id);
  if (!product) return c.json({ error: 'Unknown product' }, 400);

  const now = Date.now();
  const orderRes = await c.env.DB.prepare(
    'INSERT INTO purchases (user_id, product_id, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, product.id, product.price_cents, 'pending', now).run();
  const orderId = orderRes.meta.last_row_id as number;

  try {
    const order = await createPaypalOrder(c.env, {
      productName: product.name,
      priceCents: product.price_cents,
      returnUrl: `${c.env.SITE_URL}/checkout?provider=paypal&status=success&order=${orderId}&pp=1`,
      cancelUrl: `${c.env.SITE_URL}/checkout?provider=paypal&status=cancel&order=${orderId}`,
      userId: user.id,
      productId: product.id,
    });
    await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('pending_paypal:' + order.id, orderId).run();
    return c.json({ id: order.id, url: order.approveUrl, order_id: orderId });
  } catch (e: any) {
    return c.json({ error: e.message || 'PayPal error' }, 500);
  }
});

app.post('/api/pay/paypal/capture', requireAuth, async (c) => {
  if (!c.env.PAYPAL_CLIENT_ID) return c.json({ error: 'PayPal not configured' }, 503);
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const orderId = body.paypal_order_id;
  if (!orderId) return c.json({ error: 'Missing paypal_order_id' }, 400);
  try {
    const result = await capturePaypalOrder(c.env, orderId);
    const completed = result.status === 'COMPLETED';
    if (completed) {
      const refId = result.purchase_units?.[0]?.reference_id || '';
      const [uidStr, productId] = refId.split(':');
      if (productId && parseInt(uidStr, 10) === user.id) {
        await fulfillProduct(c.env, user.id, productId);
      }
      await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE user_id = ? AND status LIKE ?')
        .bind('completed', user.id, 'pending_paypal:' + orderId).run();
    }
    return c.json({ ok: completed, result });
  } catch (e: any) {
    return c.json({ error: e.message || 'PayPal capture error' }, 500);
  }
});

async function fulfillProduct(env: Bindings, userId: number, productId: string) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  const now = Date.now();
  if (product.type === 'coins' && (product as any).amount) {
    await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind((product as any).amount, userId).run();
  } else if (product.type === 'subscription') {
    let tier = 'pro';
    if (productId.startsWith('operative')) tier = 'operative';
    else if (productId.startsWith('legend')) tier = 'legend';
    else if (productId.startsWith('studio')) tier = 'studio';
    else if (productId.startsWith('starter')) { tier = 'starter'; }
    await env.DB.prepare('UPDATE users SET tier = ?, coins = coins + ? WHERE id = ?')
      .bind(tier, productId.startsWith('starter') ? 200 : productId.startsWith('operative') ? 500 : 0, userId).run();
  }
  await env.DB.prepare(
    `INSERT INTO inventory (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1`
  ).bind(userId, productId, now).run();
}

/* ─── Tournaments ──────────────────────────── */
app.get('/api/tournaments', async (c) => {
  const now = Date.now();
  const rows = await c.env.DB.prepare(
    `SELECT t.*,
       (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS entries
     FROM tournaments t
     WHERE t.status != 'closed'
     ORDER BY t.starts_at ASC`
  ).all();
  return c.json({ tournaments: rows.results, now });
});

app.get('/api/tournaments/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const t = await c.env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(id).first<any>();
  if (!t) return c.json({ error: 'not_found' }, 404);
  const board = await c.env.DB.prepare(
    `SELECT u.username, u.display_name, e.best_score, e.paid
     FROM tournament_entries e JOIN users u ON u.id = e.user_id
     WHERE e.tournament_id = ?
     ORDER BY e.best_score DESC LIMIT 50`
  ).bind(id).all();
  return c.json({ tournament: t, leaderboard: board.results });
});

app.post('/api/tournaments/:id/join', requireAuth, async (c) => {
  const user = (c as any).user;
  const id = parseInt(c.req.param('id'), 10);
  const t = await c.env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(id).first<any>();
  if (!t) return c.json({ error: 'not_found' }, 404);
  const now = Date.now();
  if (t.ends_at < now) return c.json({ error: 'Tournament has ended' }, 400);

  // Age gate: cash prize tournaments require 18+ verified
  if (t.prize_pool_cents > 0) {
    if (!user.age_verified) return c.json({ error: 'age_required', message: 'You must verify your age (18+) to enter cash tournaments.' }, 403);
    if (user.date_of_birth) {
      const dob = new Date(user.date_of_birth);
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 18) return c.json({ error: 'underage', message: 'You must be 18 or older to enter cash tournaments.' }, 403);
    }
  }

  const existing = await c.env.DB.prepare('SELECT id, paid FROM tournament_entries WHERE tournament_id = ? AND user_id = ?')
    .bind(id, user.id).first<any>();
  if (existing?.paid) return c.json({ ok: true, already: true });

  if (t.entry_cents === 0) {
    await c.env.DB.prepare(
      `INSERT INTO tournament_entries (tournament_id, user_id, best_score, paid, created_at)
       VALUES (?, ?, 0, 1, ?)
       ON CONFLICT(tournament_id, user_id) DO UPDATE SET paid = 1`
    ).bind(id, user.id, now).run();
    return c.json({ ok: true, joined: true });
  }
  if (user.coins >= Math.ceil(t.entry_cents / 10)) {
    const coinCost = Math.ceil(t.entry_cents / 10);
    await c.env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').bind(coinCost, user.id).run();
    await c.env.DB.prepare(
      `INSERT INTO tournament_entries (tournament_id, user_id, best_score, paid, created_at)
       VALUES (?, ?, 0, 1, ?)
       ON CONFLICT(tournament_id, user_id) DO UPDATE SET paid = 1`
    ).bind(id, user.id, now).run();
    return c.json({ ok: true, joined: true, paid_with: 'coins', coin_cost: coinCost });
  }
  return c.json({ ok: false, need_payment: true, entry_cents: t.entry_cents }, 402);
});

/* ─── Age Verification ──────────────────────────── */
app.post('/api/auth/verify-age', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const dob = (body.date_of_birth || '').toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return c.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, 400);
  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) return c.json({ error: 'Invalid date.' }, 400);
  const age = (Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 13) return c.json({ error: 'You must be at least 13 years old to use NEXA Arcade.' }, 400);
  const isAdult = age >= 18;
  await c.env.DB.prepare(
    'UPDATE users SET date_of_birth = ?, age_verified = ?, age_verified_at = ? WHERE id = ?'
  ).bind(dob, isAdult ? 1 : 0, Date.now(), user.id).run();
  return c.json({ ok: true, age_verified: isAdult, age: Math.floor(age) });
});

/* ─── Creator applications (Nexa Studio) ───── */
app.post('/api/creators/apply', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body.name || '').toString().trim().slice(0, 100);
  const email = (body.email || '').toString().trim().toLowerCase();
  const website = (body.website || '').toString().slice(0, 300);
  const portfolio = (body.portfolio || '').toString().slice(0, 300);
  const about = (body.about || '').toString().slice(0, 2000);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || about.length < 20) {
    return c.json({ error: 'Please fill in name, valid email, and at least 20 characters about you.' }, 400);
  }
  const user = await getUserFromSession(c);
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO creator_applications (user_id, name, email, website, portfolio, about, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(user?.id || null, name, email, website, portfolio, about, now).run();
  return c.json({ ok: true });
});

app.post('/api/daily-pulse', requireAuth, async (c) => {
  const user = (c as any).user;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Check if already claimed today in DB
  const lastClaim = await c.env.DB.prepare('SELECT created_at FROM activity_log WHERE user_id = ? AND type = "daily_pulse" ORDER BY created_at DESC LIMIT 1')
    .bind(user.id).first<{ created_at: number }>();
  
  if (lastClaim) {
    const lastDate = new Date(lastClaim.created_at).toISOString().split('T')[0];
    if (lastDate === today) return c.json({ error: 'already_claimed' }, 409);
  }

  const reward = 100; // Base daily reward
  await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(reward, user.id).run();
  await c.env.DB.prepare('INSERT INTO activity_log (user_id, type, created_at) VALUES (?, "daily_pulse", ?)')
    .bind(user.id, Date.now()).run();

  return c.json({ ok: true, reward });
});

app.get('/api/stats/real-time', async (c) => {
  const totalUsers = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<any>();
  const totalScores = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM scores').first<any>();
  const recent = await c.env.DB.prepare(`
    SELECT u.username, s.game_id, s.score, s.created_at 
    FROM scores s 
    JOIN users u ON s.user_id = u.id 
    ORDER BY s.created_at DESC 
    LIMIT 5
  `).all();
  
  return c.json({
    users: totalUsers?.count ?? 0,
    scores: totalScores?.count ?? 0,
    activity: recent.results || []
  });
});

app.get('/api/inventory', requireAuth, async (c) => {
  const user = (c as any).user;
  const items = await c.env.DB.prepare('SELECT * FROM inventory WHERE user_id = ?').bind(user.id).all();
  return c.json({ items: items.results });
});

app.post('/api/inventory/add', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const { item_id } = body;
  if (!item_id) return c.json({ error: 'invalid_data' }, 400);

  await c.env.DB.prepare(`
    INSERT INTO inventory (user_id, item_id, quantity, acquired_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1
  `).bind(user.id, item_id, Date.now()).run();

  return c.json({ ok: true });
});

app.get('/api/governance', async (c) => {
  const games = await c.env.DB.prepare(`
    SELECT ug.*, 
    (SELECT COUNT(*) FROM governance_votes WHERE game_id = ug.id AND vote_type = 'up') AS upvotes,
    (SELECT COUNT(*) FROM governance_votes WHERE game_id = ug.id AND vote_type = 'down') AS downvotes
    FROM upcoming_games ug
    ORDER BY created_at DESC
  `).all();
  return c.json({ proposals: games.results });
});

app.post('/api/governance/vote', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const { game_id, type } = body;
  if (!game_id || !['up', 'down'].includes(type)) return c.json({ error: 'invalid_data' }, 400);

  await c.env.DB.prepare(`
    INSERT INTO governance_votes (user_id, game_id, vote_type, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, game_id) DO UPDATE SET vote_type = excluded.vote_type, created_at = excluded.created_at
  `).bind(user.id, game_id, type, Date.now()).run();

  return c.json({ ok: true });
});

// ---------- arena / live presence ----------
app.post('/api/arena/heartbeat', requireAuth, async (c) => {
  const user = (c as any).user;
  const body = await c.req.json().catch(() => ({}));
  const { game_id, score } = body;
  if (!game_id) return c.json({ error: 'invalid_data' }, 400);

  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO live_presence (user_id, username, game_id, score, last_heartbeat, status)
    VALUES (?, ?, ?, ?, ?, 'playing')
    ON CONFLICT(user_id) DO UPDATE SET 
      game_id = excluded.game_id,
      score = excluded.score,
      last_heartbeat = excluded.last_heartbeat,
      status = 'playing'
  `).bind(user.id, user.username, game_id, score || 0, now).run();

  return c.json({ ok: true });
});

app.get('/api/arena/live', async (c) => {
  const now = Date.now();
  const staleLimit = now - 30000; // 30 seconds stale

  // Cleanup stale
  await c.env.DB.prepare('DELETE FROM live_presence WHERE last_heartbeat < ?').bind(staleLimit).run();

  const live = await c.env.DB.prepare(`
    SELECT lp.*, u.avatar, u.xp, u.level
    FROM live_presence lp
    JOIN users u ON lp.user_id = u.id
    ORDER BY lp.score DESC
    LIMIT 10
  `).all<any>();

  return c.json({
    top_player: live.results[0] || null,
    live_players: live.results || []
  });
});

// ---------- newsletter ----------
app.post('/api/newsletter', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').toString().trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: 'Invalid email' }, 400);
  await c.env.DB.prepare('INSERT OR IGNORE INTO newsletter (email, created_at) VALUES (?, ?)').bind(email, Date.now()).run();
  return c.json({ ok: true });
});

// ---------- multiplayer (Durable Object) ----------
app.get('/api/mp/:gameId/:roomId', async (c) => {
  const { gameId, roomId } = c.req.param();
  const id = c.env.GAME_ROOM.idFromName(`${gameId}:${roomId}`);
  const stub = c.env.GAME_ROOM.get(id);
  const user = await getUserFromSession(c);
  const url = new URL(c.req.url);
  url.searchParams.set('gameId', gameId);
  url.searchParams.set('roomId', roomId);
  if (user) { url.searchParams.set('userId', String(user.id)); url.searchParams.set('username', user.username); }
  else { url.searchParams.set('username', 'Guest' + Math.floor(Math.random() * 10000)); }
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// ---------- ads.txt ----------
app.get('/ads.txt', (c) => c.text('google.com, pub-5800977493749262, DIRECT, f08c47fec0942fa0\n', 200, { 'Content-Type': 'text/plain' }));
app.get('/robots.txt', (c) => c.text(`User-agent: *\nAllow: /\nSitemap: https://getnexa.space/sitemap.xml\n`, 200, { 'Content-Type': 'text/plain' }));
app.get('/sitemap.xml', async (c) => {
  const xml = await generateSitemap(c.env);
  return c.text(xml, 200, { 'Content-Type': 'application/xml' });
});

// ---------- Programmatic SEO / AEO Interceptor ----------
app.get('/games/:id', async (c) => {
  const userAgent = c.req.header('user-agent') || '';
  const isBot = /bot|googlebot|crawler|spider|robot|crawling|openai|perplexity/i.test(userAgent);
  const gameId = c.req.param('id');
  
  // If not a bot, let the SPA handle it via ASSETS.fetch
  if (!isBot) return c.env.ASSETS.fetch(c.req.raw);

  // Bot identified: Serve high-density SEO/AEO payload
  const game = GAME_RELEASE_QUEUE.find(id => id === gameId);
  if (!game) return c.env.ASSETS.fetch(c.req.raw);

  const title = `${gameId.toUpperCase()} | NEXA ARCADE - Strategy & High Performance`;
  const desc = `Master the grid in ${gameId}. Zero-latency browser gaming at its peak. Synchronize your neural console now.`;
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <meta name="description" content="${desc}">
      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${desc}">
      <meta property="og:url" content="${c.env.SITE_URL}/games/${gameId}">
      <meta property="og:type" content="website">
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": "${gameId}",
        "description": "${desc}",
        "url": "${c.env.SITE_URL}/games/${gameId}",
        "applicationCategory": "GameApplication",
        "operatingSystem": "Web"
      }
      </script>
    </head>
    <body>
      <h1>${title}</h1>
      <p>${desc}</p>
      <section>
        <h2>Nexa Strategy: How to win at ${gameId}</h2>
        <ul>
          <li>Focus on high-velocity input synchronization.</li>
          <li>Monitor the neural grid for cache drops (Loot Boxes).</li>
          <li>Maintain 60fps focus to minimize reactive latency.</li>
        </ul>
      </section>
      <a href="${c.env.SITE_URL}/games/${gameId}">Play Now</a>
    </body>
    </html>
  `);
});

/* ─── Blog API ──────────────────────────── */
app.get('/api/blog', async (c) => {
  const url = new URL(c.req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10), 50);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
  const category = url.searchParams.get('category') || '';
  const query = category
    ? 'SELECT id,slug,title,excerpt,category,tags,author,image_emoji,read_time,published_at FROM blog_posts WHERE category=? ORDER BY published_at DESC LIMIT ? OFFSET ?'
    : 'SELECT id,slug,title,excerpt,category,tags,author,image_emoji,read_time,published_at FROM blog_posts ORDER BY published_at DESC LIMIT ? OFFSET ?';
  const countQuery = category
    ? 'SELECT COUNT(*) AS n FROM blog_posts WHERE category=?'
    : 'SELECT COUNT(*) AS n FROM blog_posts';
  const [rows, countRow] = await Promise.all([
    category ? c.env.DB.prepare(query).bind(category, limit, offset).all() : c.env.DB.prepare(query).bind(limit, offset).all(),
    category ? c.env.DB.prepare(countQuery).bind(category).first<any>() : c.env.DB.prepare(countQuery).first<any>(),
  ]);
  return c.json({ posts: rows.results, total: countRow?.n ?? 0, limit, offset });
});

app.get('/api/blog/:slug', async (c) => {
  const slug = c.req.param('slug');
  const post = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE slug = ?').bind(slug).first<any>();
  if (!post) return c.json({ error: 'not_found' }, 404);
  return c.json({ post });
});

app.get('/blog/:slug', async (c) => {
  const userAgent = c.req.header('user-agent') || '';
  const isBot = /bot|googlebot|crawler|spider|robot|crawling|openai|perplexity/i.test(userAgent);
  if (!isBot) return c.env.ASSETS.fetch(c.req.raw);
  const slug = c.req.param('slug');
  const post = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE slug = ?').bind(slug).first<any>();
  if (!post) return c.env.ASSETS.fetch(c.req.raw);
  return c.html(`<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8"><title>${post.title} | NEXA Arcade Blog</title>
    <meta name="description" content="${post.meta_description}">
    <meta name="keywords" content="${post.meta_keywords}">
    <meta property="og:title" content="${post.title}">
    <meta property="og:description" content="${post.meta_description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://getnexa.space/blog/${post.slug}">
    <meta property="article:published_time" content="${new Date(post.published_at).toISOString()}">
    <script type="application/ld+json">${JSON.stringify({
      "@context":"https://schema.org","@type":"Article",
      "headline":post.title,"description":post.meta_description,
      "author":{"@type":"Organization","name":"NEXA Arcade"},
      "publisher":{"@type":"Organization","name":"NEXA Arcade","url":"https://getnexa.space"},
      "datePublished":new Date(post.published_at).toISOString(),
      "url":"https://getnexa.space/blog/"+post.slug
    })}</script>
  </head><body>
    <h1>${post.title}</h1>
    <p>${post.excerpt}</p>
    <div>${post.content}</div>
    <a href="https://getnexa.space/games">Play Free Games at NEXA Arcade</a>
  </body></html>`);
});

// Fallback to static assets (SPA)
app.all('*', async (c) => c.env.ASSETS.fetch(c.req.raw));

async function appendHourlySpotlight(env: Bindings): Promise<void> {
  const catalog = await getPublishedCatalog(env);
  const gameId = catalog.upcoming[0];
  if (!gameId) return;
  const now = Date.now();
  await env.DB.prepare('INSERT INTO hourly_featured (game_id, created_at) VALUES (?, ?)').bind(gameId, now).run();
}

async function generateSitemap(env: Bindings): Promise<string> {
  const catalog = await getPublishedCatalog(env);
  const base = env.SITE_URL;
  const staticPaths = ['', '/games', '/tournaments', '/blog', '/creators', '/about', '/privacy', '/terms', '/shop', '/leaderboards'];
  const gamePaths = catalog.order.map(id => `/games/${id}`);
  let blogPaths: string[] = [];
  try {
    const blogRows = await env.DB.prepare('SELECT slug FROM blog_posts ORDER BY published_at DESC LIMIT 100').all<any>();
    blogPaths = (blogRows.results || []).map((r: any) => `/blog/${r.slug}`);
  } catch {}
  const urls = [...staticPaths, ...gamePaths, ...blogPaths].map(p =>
    `<url><loc>${base}${p}</loc><changefreq>${p.startsWith('/blog') ? 'daily' : 'weekly'}</changefreq><priority>${p === '' ? '1.0' : p.startsWith('/blog/') ? '0.7' : '0.8'}</priority></url>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

async function pingSearchEngines(env: Bindings) {
  const sitemapUrl = encodeURIComponent(`${env.SITE_URL}/sitemap.xml`);
  try {
    // Google Ping
    await fetch(`https://www.google.com/ping?sitemap=${sitemapUrl}`);
    // Bing Ping
    await fetch(`https://www.bing.com/ping?sitemap=${sitemapUrl}`);
  } catch (e) {
    console.error("Sitemap Ping Error:", e);
  }
}

/* ─── Blog Generation (cron) ──────────────────────────── */
const BLOG_POOL: Array<{
  slug: string; title: string; excerpt: string; meta_description: string; keywords: string;
  emoji: string; category: string; read_time: number; h2s: [string, string, string];
  tips: string[]; intro: string; body: string; conclusion: string; game_ids: string[]; video_search: string;
}> = [
  { slug:'best-free-browser-games-2025', title:'Best Free Browser Games to Play Online in 2025', excerpt:'Discover 50+ instant-play browser games with no download required — puzzles, action, multiplayer, and more.', meta_description:'Play the best free browser games in 2025. Instant access to Snake, Tetris, 2048, Chess, Pac-Man and 50+ more. No download needed.', keywords:'free browser games, best online games 2025, play games online free, HTML5 games', emoji:'🎮', category:'lists', read_time:6, h2s:['Why Browser Games Are Thriving in 2025','Top Categories Worth Exploring','How to Find Your Perfect Game'], tips:['Start with puzzle games if you like calm focused play','Try multiplayer games for social gaming sessions','Bookmark your favorites for quick daily sessions','Use category filters to discover hidden gems','Challenge yourself on the leaderboards'], intro:'Browser gaming has had a massive resurgence. No app stores, no installs, no subscriptions required — just click and play. NEXA Arcade hosts over 50 hand-picked games across every genre.', body:'The secret behind browser gaming success is accessibility. Any device with a modern browser can run these games at full speed. Whether you have 5 minutes or 5 hours, there\'s a game sized exactly right for your session.', conclusion:'Ready to explore? Head to the games library and start with a genre that sounds fun. With 50+ titles and new ones added regularly, you\'ll never run out of things to play.', game_ids:['snake','2048','tetris','chess','pacman'] , video_search:'best free browser games online 2025'},
  { slug:'how-to-get-high-score-tetris', title:'Tetris Strategy Guide: How to Maximize Your Score Online', excerpt:'Master T-spins, line clears, and back-to-back bonuses with this complete Tetris strategy guide for browser play.', meta_description:'Learn advanced Tetris strategy: T-spins, combo multipliers, stacking technique, and how to consistently score over 50,000 in free browser Tetris.', keywords:'tetris strategy, tetris high score tips, how to play tetris better, tetris t-spin guide', emoji:'🧩', category:'guides', read_time:7, h2s:['The Stack: Building a Clean Foundation','T-Spins and Combos Explained','Staying Calm Under Speed'], tips:['Keep the left side clear for long pieces','Preview the next 3 pieces and plan ahead','Practice T-spins in slow mode first','Never let columns exceed 16 rows','Use soft drop instead of hard drop when unsure'], intro:'Tetris is one of the most studied games in history. From casual play to competitive speedruns, there\'s a depth of strategy most players never discover. This guide unlocks the fundamentals.', body:'The core of high-score Tetris is efficient stacking. Every line clear should be a deliberate decision, not a reaction. Learn to read upcoming pieces 3 steps ahead and your score will double within a week of practice.', conclusion:'The best way to improve at Tetris is consistent daily sessions. Even 10 minutes a day builds the pattern recognition that separates average players from high scorers.', game_ids:['tetris','tetris-ext'] , video_search:'tetris strategy guide high score tutorial'},
  { slug:'2048-strategy-guide', title:'2048 Strategy: How to Consistently Reach the 2048 Tile', excerpt:'Learn the corner strategy, merge patterns, and decision-making techniques to reliably reach 2048 every time you play.', meta_description:'Master 2048 with this complete strategy guide. Corner method, merge optimization, and common mistakes to avoid. Play free at NEXA Arcade.', keywords:'2048 strategy, how to beat 2048, 2048 tips, 2048 corner method, 2048 high score', emoji:'🔢', category:'guides', read_time:5, h2s:['The Corner Strategy: Your Foundation','Merge Chains and Priority Ordering','Recovery Techniques When Things Go Wrong'], tips:['Always keep your highest tile in a corner','Never move tiles away from your main corner','Build descending rows of connected values','Avoid random swipes — every move should have purpose','If stuck, sacrifice the second column to reset'], intro:'2048 looks random but it\'s one of the most strategic puzzle games ever designed. With the right framework, you can reach the 2048 tile 90% of the time — and go beyond to 4096 and 8192.', body:'The corner method is the key insight. Lock your largest tile in the bottom-right corner and build descending value rows leading into it. This creates merge chains that snowball your score automatically.', conclusion:'Practice the corner method for 20 games and you\'ll internalize it. From there, reaching 2048 becomes mechanical and the challenge becomes pushing to the next milestone.', game_ids:['2048','2048-ext'] , video_search:'2048 game strategy corner method guide'},
  { slug:'minesweeper-beginner-to-expert', title:'Minesweeper Tactics: From Beginner to Expert in One Guide', excerpt:'Uncover the logic patterns, flagging strategy, and probability thinking that turn Minesweeper from guesswork into science.', meta_description:'Complete Minesweeper guide: pattern recognition, probability analysis, 50/50 situations, and expert-level techniques to clear boards faster.', keywords:'minesweeper strategy, minesweeper tips, how to win minesweeper, minesweeper patterns', emoji:'💣', category:'guides', read_time:8, h2s:['Basic Number Patterns Every Player Should Know','The 50/50 Dilemma: When to Guess','Speed Techniques for Faster Clears'], tips:['Always start in the corner to open large areas','Learn the 1-2 and 1-2-1 patterns by heart','Flag mines immediately when certain to avoid mistakes','Count remaining mines in each section independently','Use the number remaining display as your guide'], intro:'Most people play Minesweeper as a game of luck. It isn\'t. Over 90% of situations have a logical solution — and the remaining 10% can be managed with smart probability analysis.', body:'The fundamental shift from beginner to intermediate is pattern recognition. The 1-2-1 pattern, the corner technique, and boundary deduction cover the vast majority of board situations. Learn these patterns and minesweeper becomes a puzzle with a solution, not a gamble.', conclusion:'The expert mindset in Minesweeper is simple: never guess when logic works, and when guessing is unavoidable, pick the statistically better option. That discipline turns a 50% win rate into an 85% win rate.', game_ids:['minesweeper','minesweeper-ext'] , video_search:'minesweeper strategy beginner to expert'},
  { slug:'chess-fundamentals-online', title:'Chess Fundamentals Every Online Gamer Should Know', excerpt:'Start winning at chess online with these foundational principles: piece values, opening strategy, tactics, and endgame basics.', meta_description:'Learn chess fundamentals for online play: piece values, opening principles, basic tactics, and winning endgame technique. Play free browser chess at NEXA Arcade.', keywords:'chess fundamentals, chess strategy beginners, chess online tips, how to get better at chess, chess pieces strategy', emoji:'♟️', category:'guides', read_time:9, h2s:['Piece Values and Trade Decisions','Opening Principles That Win Games','Tactics: The Core of Chess Improvement'], tips:['Control the center with pawns and pieces','Develop all your pieces before attacking','Castle early to protect your king','Avoid moving the same piece twice in the opening','Always calculate captures: gain vs. loss'], intro:'Chess is the ultimate skill game. Played for over 1,500 years, it rewards pattern recognition, calculation, and strategic thinking. Even basic fundamentals will double your win rate against casual players.', body:'The biggest difference between beginners and intermediate players is piece activity. Beginners move pieces reactively. Intermediate players develop all pieces first, control central squares, and only attack when pieces are ready. This principle alone wins hundreds of games.', conclusion:'The fastest way to improve is to analyze your games after you play. Find the move where things went wrong and look for better alternatives. Even casual analysis once a week produces dramatic improvement.', game_ids:['chess'] , video_search:'chess fundamentals beginners online strategy'},
  { slug:'why-browser-games-rule-2025', title:'Why Browser Games Are Dominating Casual Gaming in 2025', excerpt:'HTML5 and WebGL have quietly made browser games competitive with mobile apps. Here\'s what\'s driving the browser gaming renaissance.', meta_description:'Browser games are back and better than ever in 2025. Discover why HTML5 gaming is beating mobile apps for casual players and how platforms like NEXA Arcade lead the charge.', keywords:'browser games 2025, HTML5 gaming, best browser games, why browser games are popular, online gaming trends', emoji:'🌐', category:'industry', read_time:5, h2s:['The Technology That Changed Everything','What Players Want That Apps Can\'t Deliver','The Future of Instant-Play Gaming'], tips:['Browser games load in seconds vs. minutes for app downloads','Play from any device without storage management','No update requirements — always the latest version','Bookmark a game and return in exactly the same state','Better for privacy: no app permissions required'], intro:'Five years ago, browser games were seen as inferior to mobile apps. That gap has closed completely. Modern HTML5 and WebGL technology produces games that match mobile app quality — and browser games offer something apps never can: zero-friction instant access.', body:'The numbers back this up. Average mobile app session length has declined while browser game sessions have grown. Players are tired of downloads, storage management, and update prompts. Browser games eliminate all of that friction and deliver the game immediately.', conclusion:'The browser gaming renaissance is real and growing. With platforms investing in quality and the technology now fully mature, browser gaming is the best place to play casual and competitive games in 2025.', game_ids:['snake','pacman','tetris','2048'] , video_search:'browser games HTML5 gaming 2025'},
  { slug:'multiplayer-browser-games-friends', title:'Best Multiplayer Browser Games to Play With Friends Right Now', excerpt:'Real-time multiplayer in your browser — no download, no setup. These are the best games to challenge your friends online.', meta_description:'Play multiplayer browser games with friends online. Real-time matches in chess, puzzle games, and arcade classics. No download required at NEXA Arcade.', keywords:'multiplayer browser games, online games with friends, play with friends online, real-time multiplayer games free', emoji:'👥', category:'lists', read_time:5, h2s:['Why Multiplayer Browser Games Work So Well','Best Competitive Options','Best Cooperative Options'], tips:['Share game links directly — no accounts needed for basic play','Create a private room for guaranteed 1v1 matches','Use the live leaderboard to track who\'s winning','Voice chat over Discord while playing for full experience','Try best-of-3 formats for evening gaming sessions'], intro:'The best gaming sessions are the ones with friends. Browser multiplayer has finally reached the quality level where you can have genuinely competitive matches without anyone installing anything.', body:'The advantage of browser multiplayer is the zero-barrier invite. Send a link, your friend clicks it, and you\'re playing in 10 seconds. No account required, no download, no version mismatch. That immediacy makes casual competitive gaming actually work.', conclusion:'Start a challenge with a friend tonight. Pick a game, share the link, and see who tops the leaderboard. Weekly challenges with friends are the best way to stay engaged and keep gaming fun.', game_ids:['chess','tictactoe','pong','connect-four'] , video_search:'multiplayer browser games play friends online'},
  { slug:'improve-reaction-time-gaming', title:'How to Improve Your Gaming Reaction Time: Science-Backed Techniques', excerpt:'Reaction time is trainable. Use these proven techniques to sharpen your response speed and dominate fast-paced games.', meta_description:'Improve gaming reaction time with science-backed techniques. Learn about cognitive training, warm-up routines, and which game types build the fastest reflexes.', keywords:'improve gaming reaction time, faster reflexes gaming, reaction time training, gaming skills improvement', emoji:'⚡', category:'tips', read_time:6, h2s:['The Science of Reaction Time in Gaming','Training Exercises That Actually Work','In-Game Habits That Build Speed'], tips:['Warm up with a fast game for 5 minutes before serious sessions','Reduce input lag: wired peripherals beat wireless for competitive play','Anticipate — predict what will happen rather than reacting to it','Train your peripheral vision by not always focusing on the center','Sleep quality directly impacts next-day reaction speed'], intro:'Average human reaction time is 250 milliseconds. Elite gamers operate at 150ms or below. That 100ms gap is entirely trainable — it\'s not genetic, it\'s practice.', body:'The key insight from reaction time research is that you\'re not training speed, you\'re training pattern recognition. Expert gamers are faster because they recognize situations earlier, not because their fingers move faster. Practice in specific game contexts builds this recognition.', conclusion:'Consistent play is the most effective reaction time training. Pick your game of choice, set a daily 15-minute session, and track your scores weekly. You\'ll see measurable improvement within a month.', game_ids:['snake','starblitz','breakout','neondrift'] , video_search:'improve gaming reaction time reflexes'},
  { slug:'wordle-strategy-guide', title:'Wordle Strategy: The Best Starting Words and Solving Techniques', excerpt:'Crack the daily Wordle in 3 guesses or fewer with these mathematically optimal starting words and deduction strategies.', meta_description:'Master Wordle with optimal starting words, letter frequency analysis, and deduction techniques. Play Wordle free online at NEXA Arcade.', keywords:'wordle strategy, best wordle starting words, how to win wordle, wordle tips, wordle hints', emoji:'📝', category:'guides', read_time:5, h2s:['Starting Words: The Mathematics of First Guesses','Deduction Strategy After Round One','Hard Mode Techniques'], tips:['CRANE is statistically the best starting word','Use your second guess to maximize new letter coverage','Never repeat letters from gray positions','Track which vowels are eliminated early','Build a mental alphabet — cross out eliminated letters'], intro:'Wordle rewards systematic thinking. While it looks like word guessing, it\'s actually a constraint elimination puzzle. With the right opening moves and deduction logic, you can solve any Wordle in 3-4 guesses consistently.', body:'The opening word is your most important decision. Research shows words containing R, A, I, S, E cover the highest probability letters. CRANE, RAISE, and SLATE are all excellent first guesses. Your second word should cover the remaining common letters not tested in round one.', conclusion:'The real skill in Wordle is pattern recognition under constraints. Practice daily, keep a mental note of which starting words you prefer, and within a month you\'ll be consistently solving in 3 guesses.', game_ids:['wordle','hangman'] , video_search:'wordle best starting words strategy guide'},
  { slug:'speed-typing-games-improve-wpm', title:'Speed Typing Games: The Fun Way to Increase Your WPM', excerpt:'Typing games are the most engaging way to build keyboard speed. Here\'s how to systematically improve your words per minute.', meta_description:'Improve your typing speed with browser-based typing games. Fun, free, and proven to increase WPM. Play typing games at NEXA Arcade.', keywords:'typing speed games, improve typing speed, words per minute training, free typing games online, typing WPM increase', emoji:'⌨️', category:'guides', read_time:5, h2s:['Why Gaming Beats Traditional Typing Practice','Progressive Difficulty: How to Structure Your Training','Tracking and Measuring Progress'], tips:['Aim for accuracy first — speed follows naturally','Type home row words exclusively for 5 minutes daily','Don\'t look at your hands — train muscle memory instead','Increase difficulty only after 95% accuracy at current speed','Practice common English words since they repeat most in real typing'], intro:'Most people plateau at 60-70 WPM because they stop challenging themselves. Typing games solve this by continuously pushing your ceiling through gamified progression.', body:'The psychological advantage of typing games over typing drills is clear: when you\'re chasing a score, you focus. When you\'re just running drills, your mind wanders. Focus is the difference between improving and grinding without progress.', conclusion:'Set a WPM goal for 30 days from now — aim for 20% above your current speed. Use typing games for 10 minutes daily. The improvement will surprise you.', game_ids:['speed-typing','typing-hero','typing-pro'] , video_search:'typing games improve words per minute'},
  { slug:'online-puzzle-games-brain-training', title:'Best Online Puzzle Games That Actually Train Your Brain', excerpt:'Not all brain training is equal. These puzzle games have genuine cognitive benefits backed by research — and they\'re free.', meta_description:'Best free online puzzle games for brain training. Play Minesweeper, 2048, Memory, Sudoku, and more. Science-backed cognitive benefits at NEXA Arcade.', keywords:'brain training games online, puzzle games for brain health, free cognitive games, online puzzle games free, best brain games 2025', emoji:'🧠', category:'lists', read_time:7, h2s:['What Makes a Puzzle Game Cognitively Valuable','The Best Games for Specific Skills','How to Build a Brain Training Routine'], tips:['Rotate between puzzle types to train different skills','Push to harder difficulty when you\'re solving too easily','Play at different times of day to challenge your cognitive state','Set goals: beat your personal best, not just complete','Discuss strategies with others to activate verbal memory'], intro:'Not every game labeled "brain training" delivers real benefits. Research points to specific cognitive skills that genuinely improve with game practice: working memory, pattern recognition, processing speed, and spatial reasoning.', body:'The games with the strongest research support are those requiring holding information in mind while solving constraints — Sudoku, 2048, and Memory games all hit this profile. Variety matters too: switching between game types challenges the brain more than repeating the same game daily.', conclusion:'Build a 20-minute daily puzzle rotation: 7 minutes on a logic game, 7 on a memory game, 6 on a quick reaction game. This variety targets the full range of cognitive skills and prevents the adaptation that reduces training value.', game_ids:['2048','memory','minesweeper','sudoku'] , video_search:'online puzzle games brain training benefits'},
  { slug:'free-solitaire-online-guide', title:'Free Solitaire Online: Best Variants and Winning Strategy', excerpt:'Klondike, FreeCell, and Spider — the three main solitaire variants explained with win-rate maximizing strategies for each.', meta_description:'Play free solitaire online. Complete guide to Klondike, FreeCell, and Spider solitaire with proven strategies. No download at NEXA Arcade.', keywords:'free solitaire online, solitaire strategy, how to win solitaire, klondike solitaire tips, best solitaire variants', emoji:'🃏', category:'guides', read_time:6, h2s:['Klondike: The Classic and Its Win Conditions','FreeCell: Near-Perfect Win Rate is Possible','Spider Solitaire: Suit Management First'], tips:['Always move Aces and 2s to foundations immediately','Uncover face-down cards as priority over foundation play','Build sequences on high cards to preserve flexibility','In FreeCell: empty columns are your most valuable resource','Plan 3 moves ahead minimum before committing'], intro:'Solitaire is the most-played single-player card game in history. Most players win by luck — but with systematic strategy, you can double your win rate and clear boards that look impossible.', body:'The universal mistake in Klondike is rushing to fill the foundation. Experienced players delay foundation placement to maintain sequence-building flexibility. A card on the tableau can be moved; a card on the foundation cannot.', conclusion:'Solitaire mastery comes from understanding the value of flexibility. Every move that reduces your options is a cost. Every move that opens new possibilities is an investment. Think in those terms and your win rate will climb.', game_ids:['solitaire'] , video_search:'solitaire strategy how to win online'},
  { slug:'gaming-benefits-cognitive-health', title:'The Science of Gaming: How Browser Games Benefit Your Mind', excerpt:'Decades of research show measurable cognitive benefits from gaming. Here\'s what the science actually says about games and brain health.', meta_description:'Research-backed cognitive benefits of gaming. Reaction time, problem solving, spatial reasoning, and stress relief explained. Play free games at NEXA Arcade.', keywords:'gaming cognitive benefits, are games good for your brain, gaming and brain health, benefits of playing games online', emoji:'🔬', category:'wellness', read_time:8, h2s:['What the Research Actually Shows','Which Game Types Produce Which Benefits','Building Healthy Gaming Habits'], tips:['30-45 minute sessions show benefits; 3+ hours show diminishing returns','Vary game types to train a wider cognitive skill set','Play games that challenge you — easy games train little','Social gaming (multiplayer) adds social cognition benefits','Track your personal records to measure cognitive improvement'], intro:'Gaming often gets bad press for its effects on the brain. The actual research is far more nuanced — and in many ways, positive. Action games improve perceptual speed. Puzzle games build spatial reasoning. Strategy games enhance planning and working memory.', body:'A landmark study by the University of Rochester found action game players develop a superior ability to make quick decisions in perceptually demanding environments. The benefit transferred to real-world tasks. Puzzle game research shows improvements in analogical reasoning that persist beyond gaming sessions.', conclusion:'The prescription is simple: play varied games, keep sessions reasonable in length, include multiplayer for social benefits, and challenge yourself regularly. The brain benefits aren\'t from gaming in general — they\'re from engaging, challenging play.', game_ids:['chess','2048','minesweeper','memory'] , video_search:'gaming cognitive brain benefits science'},
  { slug:'competitive-leaderboard-gaming-guide', title:'How to Dominate Online Gaming Leaderboards: A Complete Guide', excerpt:'Claim your spot at the top of the leaderboard with these systematic improvement techniques used by top competitive players.', meta_description:'Dominate online game leaderboards with expert strategies. Score maximization, technique optimization, and mental game — complete competitive guide at NEXA Arcade.', keywords:'online leaderboard tips, how to get high scores online, competitive gaming strategy, leaderboard domination guide', emoji:'🏆', category:'competitive', read_time:7, h2s:['Understanding What the Leaderboard Actually Measures','The Improvement Loop That Works','Mental Game and Consistency'], tips:['Study the #1 score: what technique produced it?','Practice the hardest parts in isolation before combining them','Set micro-goals: beat your personal best by 5% each session','Record or replay your best runs to identify patterns','Compete against yourself first, others second'], intro:'Most leaderboard players focus on playing more. The top players focus on improving. That distinction determines who climbs and who plateaus. This guide is about systematic improvement, not grinding.', body:'The improvement loop is simple: identify your limiting factor (reaction speed? decision speed? technique?), isolate and practice that factor specifically, reintegrate into full gameplay, and measure the result. One cycle per week produces exponential long-term improvement.', conclusion:'Leaderboard success is a process, not an event. Consistent improvement over 30 days beats any single lucky run. Build the process and the result follows.', game_ids:['snake','2048','tetris','breakout'] , video_search:'competitive gaming leaderboard tips strategy'},
  { slug:'mobile-browser-gaming-guide', title:'Mobile Browser Gaming in 2025: The Best Touchscreen Games', excerpt:'Mobile browser gaming has hit a new quality ceiling. These are the best games optimized for touchscreen play — no app download needed.', meta_description:'Best mobile browser games for touchscreen in 2025. Play free online games on iPhone and Android without downloading apps. NEXA Arcade is fully mobile optimized.', keywords:'mobile browser games, games on phone no download, best touchscreen games online, mobile gaming free 2025', emoji:'📱', category:'lists', read_time:5, h2s:['Why Mobile Browser Gaming Works Now','Best Touchscreen Game Types','Tips for Better Mobile Gaming Sessions'], tips:['Use landscape mode for action and racing games','Enable haptic feedback for tactile gaming response','Bookmark your favorite games to the home screen','Play in airplane mode after first load for offline access','Use headphones — mobile sound design rewards it'], intro:'Mobile browser gaming used to mean compromised controls and slow loading. In 2025, that\'s completely changed. HTML5 games load in under 3 seconds on 4G and offer touch controls designed specifically for mobile screens.', body:'The games that work best on touchscreen are those with simple, large touch targets: Snake, 2048, Solitaire, and Word games are all excellent mobile choices. Action games benefit from NEXA\'s virtual joystick controls that activate automatically on touch devices.', conclusion:'Add NEXA Arcade to your phone\'s home screen for one-tap access. Mobile gaming sessions during commutes, breaks, or downtime are perfect for casual play — and you\'re always just one tap from a leaderboard challenge.', game_ids:['snake','2048','solitaire','wordle'] , video_search:'mobile browser gaming touchscreen games'},
  { slug:'gaming-tournament-guide-beginners', title:'Your First Online Gaming Tournament: What to Expect and How to Prepare', excerpt:'Competitive gaming tournaments aren\'t just for pros. This guide covers everything beginners need to know to enter and compete.', meta_description:'Enter your first online gaming tournament with confidence. Complete beginner guide: how tournaments work, how to prepare, and how to maximize your result.', keywords:'online gaming tournament guide, gaming tournament for beginners, how to enter gaming tournament, competitive gaming first time', emoji:'🏅', category:'competitive', read_time:6, h2s:['How Online Gaming Tournaments Work','Preparation Strategy for Your First Tournament','During the Tournament: Mental Performance'], tips:['Practice the specific tournament game for 1 week before entry','Know the scoring rules exactly — hidden points cost rankings','Warm up for 15 minutes before your tournament session starts','Take a 5-minute break if you go on a losing streak','Focus on your personal best, not beating specific opponents'], intro:'Gaming tournaments feel intimidating from the outside. Once you enter one, you\'ll realize they\'re structured, fair, and genuinely exciting. This guide removes the mystery and gets you ready to compete.', body:'NEXA Arcade tournaments run on a simple leaderboard format: enter, play your best run, and your highest score during the tournament period determines your placement. There\'s no scheduling, no elimination rounds, and no waiting. Play at your best time, on your best day.', conclusion:'The tournament experience is fundamentally different from casual play. Knowing your score matters changes how you approach each session. Enter one tournament this month — even just to see how your performance changes under that pressure.', game_ids:['snake','tetris','2048','breakout'] , video_search:'online gaming tournament guide beginners'},
  { slug:'flappy-bird-high-score-tips', title:'Flappy Bird Online: How to Get Past 50 Points Consistently', excerpt:'Flappy Bird seems random but it has a rhythm. Learn the timing patterns, pipe strategies, and mental techniques to hit 50+ consistently.', meta_description:'Get a high score in Flappy Bird online. Timing technique, rhythm patterns, and mental focus strategies explained. Play free Flappy Bird at NEXA Arcade.', keywords:'flappy bird high score, how to get good at flappy bird, flappy bird tips, flappy bird strategy, flappy bird online free', emoji:'🐦', category:'guides', read_time:4, h2s:['The Rhythm Secret Most Players Miss','Pipe Positioning Technique','Managing Frustration for Longer Sessions'], tips:['Tap to maintain altitude in the upper middle of the screen','Find the rhythm: tap every 2-3 seconds in a consistent pattern','Focus on the gap\'s vertical center, not the approaching pipes','Take breaks after 5 consecutive deaths to reset frustration','Play at the same time each day — consistency builds pattern memory'], intro:'Flappy Bird\'s genius is its deceptive simplicity. One button, one mechanic, infinite frustration. But consistent 50+ scores aren\'t luck — they\'re achievable with a specific technique.', body:'The key insight is rhythm over reaction. Players who get high scores aren\'t reacting to each pipe — they\'re maintaining a consistent tapping rhythm that naturally navigates most gaps. This rhythm must be calibrated in the first 5-10 pipes to match the current pipe pattern.', conclusion:'Flappy Bird is a patience and rhythm game pretending to be a reaction game. Approach it with that mindset, accept early deaths as calibration, and watch your scores climb past what you thought was your ceiling.', game_ids:['flappy-bird'] , video_search:'flappy bird high score tips strategy'},
  { slug:'snake-game-high-score-guide', title:'Snake Game Strategy: How to Score 1000+ Points Consistently', excerpt:'Master the wall-hugging technique, safe zone strategy, and apple routing that separates casual Snake players from high scorers.', meta_description:'Get over 1000 points in Snake game online. Learn wall-hugging, safe zones, and apple routing technique. Play free Snake at NEXA Arcade.', keywords:'snake game high score, snake game strategy, how to get good at snake, snake game tips, play snake online free', emoji:'🐍', category:'guides', read_time:5, h2s:['Wall Hugging: The Core High-Score Technique','Safe Zone Management as the Snake Grows','When to Break the Pattern'], tips:['Start by hugging the outer wall clockwise or counterclockwise','Only deviate from the wall pattern to collect apples','When you can\'t return to the wall, make a small box loop','Never cross your own tail — treat it like a wall','Plan your apple route 3 moves ahead, not just the next move'], intro:'Snake is the original mobile game — and its simplicity hides genuine depth. A basic player scores 200-300 points. A skilled player scores 2000+. The difference is one technique: systematic wall-hugging.', body:'The wall-hugging strategy works because it creates predictable, easy-to-maintain movement that avoids the chaotic center of the board. As the snake grows, the center becomes dangerous. Wall patterns keep you in safe territory until forced to navigate inward.', conclusion:'Practice wall-hugging for 10 sessions and it becomes automatic. From there, high scores come from disciplined apple routing and the patience to wait for safe opportunities rather than rushing dangerous paths.', game_ids:['snake','snake-ext'] , video_search:'snake game high score strategy'},
  { slug:'pacman-perfect-strategy', title:'Pac-Man Online: Ghost Patterns and Perfect Route Strategy', excerpt:'Pac-Man\'s ghosts aren\'t random — they have specific patterns. Learn how to exploit them to clear levels without dying.', meta_description:'Master Pac-Man online with ghost behavior patterns, optimal routing, and power pellet timing. Play free Pac-Man browser game at NEXA Arcade.', keywords:'pacman strategy, pacman ghost patterns, how to play pacman better, pacman high score, free pacman online', emoji:'👾', category:'guides', read_time:6, h2s:['The Four Ghosts: How Each One Moves','Optimal Dot Collection Routes','Power Pellet Timing for Maximum Points'], tips:['Blinky (red) follows your exact path — don\'t loop','Pinky (pink) targets 4 tiles ahead of Pac-Man — cut corners','Inky (blue) uses a complex rule involving Blinky\'s position','Clyde (orange) chases until close, then retreats','Eat power pellets only when multiple ghosts are clustered'], intro:'Pac-Man appears to be a maze game. It\'s actually a pattern memorization and ghost behavior prediction game. Once you understand how each ghost moves, the game transforms from frantic survival to calculated routing.', body:'The most important ghost to understand is Blinky (red): it directly chases your current position. This means you can lead Blinky into predictable paths. The most useful technique is luring Blinky along a wall, then reversing direction to create a ghost-free corridor.', conclusion:'Spend one session just observing ghost movement without worrying about dots. Understanding the patterns turns Pac-Man from a panic game into a strategy game — and your score will reflect that shift immediately.', game_ids:['pacman'] , video_search:'pacman ghost patterns strategy guide'},
  { slug:'crossy-road-tips-guide', title:'Crossy Road Tips: How to Survive Longer and Score Higher', excerpt:'Crossy Road is deceptively simple. These 5 techniques will triple your hop count and unlock characters faster.', meta_description:'Crossy Road tips and tricks to survive longer, score higher, and unlock rare characters. Play free Crossy Road online at NEXA Arcade.', keywords:'crossy road tips, crossy road strategy, crossy road high score, crossy road unlock characters, play crossy road online', emoji:'🐔', category:'guides', read_time:4, h2s:['The Timing Window Most Players Miss','Lane Reading: Left vs Right Approach','Character Selection and Score Bonuses'], tips:['Wait for vehicles to pass completely before hopping','Hop diagonally when possible to cover more ground safely','Never rush on water — count the logs before jumping','Stay center on roads — edge spawns have fewer escape routes','Farm coins on safe platforms before pushing your score'], intro:'Crossy Road looks like a kids game. Players who break the top 100 on the leaderboard know different — it demands timing precision, lane reading, and risk management under pressure.', body:'The central skill is recognizing traffic density patterns in your lane before committing. Roads cycle between dense and sparse windows. Expert players hop slowly through dense windows and sprint through gaps. Rushing through dense traffic is the #1 score killer at any level.', conclusion:'Your first 50 hops determine your score. Stay disciplined on those early roads, bank distance quickly on water sections, and only push when the path is clear. Survival is always worth more than speed.', game_ids:['crossy-road'], video_search:'crossy road tips high score survival strategy' },
  { slug:'doodle-jump-expert-guide', title:'Doodle Jump: Expert Tips to Reach Altitude 100,000+', excerpt:'Doodle Jump rewards consistent platform reading, not luck. Here is how pros reach six-figure altitude scores.', meta_description:'Doodle Jump expert tips: platform types, monster dodging, power-up strategy, and altitude records. Play free Doodle Jump at NEXA Arcade.', keywords:'doodle jump tips, doodle jump high score, doodle jump strategy, play doodle jump online free', emoji:'🪜', category:'guides', read_time:5, h2s:['Platform Types and Jump Priorities','Power-Ups: Which to Use and When','Monster Mechanics and Avoidance Timing'], tips:['White platforms are safe — prioritize them over springs','Jet packs beat spring jumps — grab them every time','Aim slightly left of center when in doubt — most layouts open left','Learn monster movement before committing to their row','Tilt input is more precise than rapid tapping — slow your tilt corrections'], intro:'Doodle Jump altitude records are not set by fast players — they are set by consistent ones. Precision platform selection and power-up prioritization determine where your run ends.', body:'The most misunderstood mechanic is platform priority. Brown crumbling platforms should be avoided at high altitude since missing them ends runs instantly. White platforms are always safe. Mastering this triage — prioritizing white, using springs correctly, and reading power-up positions — forms the entire skill ceiling.', conclusion:'Build your mental platform map during the first 20,000 altitude. Once pattern recognition is automatic, you stop reacting and start planning. That is when altitude records get broken.', game_ids:['doodle-jump'], video_search:'doodle jump tips high altitude strategy guide' },
  { slug:'connect-four-win-every-time', title:'Connect Four Strategy: How to Win Almost Every Time', excerpt:'Connect Four is a solved game — and that means there are concrete strategies that win reliably. Here is the playbook.', meta_description:'Connect Four winning strategy: center column control, trap setups, blocking, and forced win sequences. Play free Connect Four at NEXA Arcade.', keywords:'connect four strategy, how to win connect four, connect four tips, connect four solved game, play connect four online', emoji:'🔴', category:'guides', read_time:5, h2s:['Center Column Control: The Foundation of Every Win','Building Double Threats Your Opponent Cannot Block','Defensive Patterns That Prevent Loss'], tips:['Always take the center column if it is empty','Create threats in two directions simultaneously','Watch for the 7 trap: force your opponent into helping you win','When you must block, block the threat that creates your own','Never fill a column above row 4 without purpose'], intro:'Connect Four was mathematically solved in 1988: the first player to move always wins with perfect play. This means there are concrete patterns that work — and learning them makes you nearly unbeatable against most players.', body:'The center column control principle is everything. Owning column 4 gives you access to more winning combinations than any other square. Research shows that 80% of Connect Four wins involve the center column — players who habitually take center when available win significantly more games.', conclusion:'The double-threat setup — creating two different winning moves your opponent can only block one of — is the endgame pattern. Build the setup in moves 6–10, and most opponents will not see it coming until it is too late.', game_ids:['connect-four'], video_search:'connect four winning strategy tips guide' },
  { slug:'simon-says-memory-mastery', title:'Simon Says Online: Memory Techniques to Beat 30+ Rounds', excerpt:'Simon Says is a pure working memory test. These cognitive techniques extend your sequence memory well beyond the casual player ceiling.', meta_description:'Simon Says strategy and memory techniques to beat 30+ rounds online. Chunking, visual anchoring, and rhythm methods explained. Play free at NEXA Arcade.', keywords:'simon says strategy, simon says memory tips, how to get better at simon says, memory game tips, simon says online free', emoji:'🔵', category:'guides', read_time:4, h2s:['Chunking: Group the Sequence into Blocks','Visual and Spatial Anchoring Techniques','Rhythm as a Memory Aid'], tips:['Group sequences into chunks of 3 rather than remembering each individually','Assign spatial locations to each color — upper left, upper right, etc.','Hum the rhythm of button presses to reinforce auditory memory','Pause after each round to mentally rehearse before it repeats','Start fresh after a mistake — do not carry anxiety into the next round'], intro:'Casual Simon Says players memorize colors one at a time. That approach hits a wall around round 10. Competitive memory players use cognitive chunking to handle 30+ sequences without strain.', body:'Chunking is the key technique: instead of remembering BLUE-GREEN-RED-BLUE as four separate items, remember B-G / R-B as two units. This immediately cuts memory load in half. Pair chunking with spatial anchoring — treating each color as a screen position rather than a color — and memory capacity roughly doubles.', conclusion:'Simon Says is an excellent working memory trainer. Players who push past round 20 regularly are developing the same cognitive skills used in music, languages, and high-stakes professional recall tasks. The game is more valuable than it looks.', game_ids:['simon-says'], video_search:'simon says memory techniques strategy guide' },
  { slug:'math-blitz-mental-math-guide', title:'Math Blitz: Mental Math Tricks to Score 500+ in 60 Seconds', excerpt:'Math Blitz is not about being a math genius — it is about knowing the right shortcuts. Here are the ones that matter.', meta_description:'Math Blitz strategy: mental math shortcuts, rapid arithmetic tricks, and practice routines to beat 500 points. Play free Math Blitz at NEXA Arcade.', keywords:'math blitz tips, mental math tricks, rapid arithmetic game, math game strategy, math blitz high score', emoji:'🔢', category:'guides', read_time:4, h2s:['Multiplication Shortcuts That Double Your Speed','Addition and Subtraction Pattern Recognition','Building a Practice Routine That Works'], tips:['Learn multiplication by 9 using the finger method','Recognize perfect squares up to 20 instantly','For two-digit addition, add tens first then units','Subtract by adding up from the smaller number','Practice daily in 5-minute bursts — consistency beats long sessions'], intro:'Math Blitz rewards rapid mental arithmetic — not advanced math. The players at the top of the leaderboard know a small set of shortcuts cold, and that handful of tricks covers 90% of the problems the game generates.', body:'The most valuable shortcut is multiplication by 9: multiply by 10 and subtract the original number. 9 × 7 becomes 70 − 7 = 63 instantly. For addition of two-digit numbers, add the tens column first, then the units, rather than right-to-left school method. This reduces the memory load at each step.', conclusion:'A focused 10-day practice run on the core shortcuts will move most players from the 200-point range to 400+. The ceiling is not intelligence — it is familiarity with the shortcut library. Build the library and the score follows.', game_ids:['math-blitz'], video_search:'mental math tricks speed arithmetic tips' },
  { slug:'balloon-pop-speed-strategy', title:'Balloon Pop Online: Reflexes, Routes, and High Score Secrets', excerpt:'Balloon Pop looks simple until you realize the top players are running systematic routes, not just clicking randomly.', meta_description:'Balloon Pop high score guide: route strategy, click timing, and reflex training. Play free Balloon Pop browser game at NEXA Arcade.', keywords:'balloon pop game tips, balloon pop high score, balloon pop strategy, reflex games online free, fast click games', emoji:'🎈', category:'tips', read_time:3, h2s:['Route Running vs Random Clicking','Pop Priority: Which Balloons Score Most','Training Your Click Speed Sustainably'], tips:['Start at the bottom of the screen — balloons rise and you follow naturally','Prioritize golden and large balloons for bonus multipliers','Use a circular route rather than random clicking to minimize wasted movement','Keep your wrist relaxed — tension slows repeated clicks','Take 30-second warmup clicks before starting a serious score run'], intro:'Most players click whatever they see first. The top scorers on Balloon Pop run a mental route, prioritize bonus balloons, and waste almost zero cursor movement. The gap between random and systematic is surprisingly large.', body:'The bottom-sweep route is the core technique: start at the bottom of the screen and sweep in a wide horizontal pattern as balloons rise. This catches balloons before they escape and keeps you in optimal position without frantic chasing. Combined with prioritizing any bonus-colored balloon that appears, the method produces consistent high scores.', conclusion:'Ten minutes of deliberate practice using the bottom-sweep route will produce better results than an hour of random clicking. The technique feels awkward at first and then becomes automatic. Once it is automatic, your scores will surprise you.', game_ids:['balloon-pop'], video_search:'balloon pop game high score tips strategy' },
  { slug:'hextris-beginner-guide', title:'Hextris Online: The Beginner Guide to Hexagonal Block Stacking', excerpt:'Hextris is Tetris in disguise — until you realize the hexagonal board changes everything. Here is how to start strong.', meta_description:'Hextris beginner guide: hexagonal stacking strategy, rotation mechanics, and how to survive longer. Play free Hextris browser game at NEXA Arcade.', keywords:'hextris tips, how to play hextris, hextris strategy, hexagonal tetris game, hextris online free', emoji:'🛑', category:'guides', read_time:5, h2s:['The Six-Sided Difference: How Hexagonal Stacking Changes Strategy','Rotation Priority and When to Switch Sides','Recovery Techniques When One Side Overloads'], tips:['Build evenly on all 6 sides — lopsided stacks collapse fast','Rotate blocks toward the thinnest side of the hex','Clear combos by matching 3+ same-color blocks before rotating','Never let any single side exceed 4 blocks without clearing','Use the preview block to plan 2 moves ahead'], intro:'Hextris players who treat it like Tetris plateau quickly. The six-sided board creates a fundamentally different balancing challenge — managing depth across six faces simultaneously rather than building a single wall.', body:'The primary skill is even distribution. Unlike Tetris where you build toward a single goal, Hextris punishes uneven sides heavily. The best players develop a scanning habit: check all six side depths every 3–4 blocks and always feed blocks to the shallower sides. Combined with color-match combo awareness, this keeps the board controlled.', conclusion:'Hextris rewards patience far more than speed. The game accelerates naturally — your job early on is to build the scanning habit so that when speed arrives, your distribution instincts are automatic.', game_ids:['hextris'], video_search:'hextris tips hexagonal tetris strategy guide' },
  { slug:'bubble-pop-combo-guide', title:'Bubble Pop Online: Combo Chains and Color Strategy', excerpt:'Bubble Pop becomes exponential when you chain combos correctly. Learn to read the board and plan 4 shots ahead.', meta_description:'Bubble Pop strategy guide: combo chains, color reading, and clearing techniques. Play free Bubble Pop browser game at NEXA Arcade.', keywords:'bubble pop strategy, bubble pop tips, bubble pop high score, bubble shooter guide, bubble pop online free', emoji:'🫧', category:'guides', read_time:4, h2s:['Reading the Board: Color Cluster Planning','Wall Bounce Shots for Hidden Angles','Combo Chains That Clear Multiple Rows'], tips:['Identify color clusters before shooting — plan the clearing sequence','Use wall bounces to reach bubbles blocked by other clusters','Save same-color shots to complete a cluster rather than randomizing','Aim for bubbles that will drop the most connected bubbles when cleared','Clear from the top — dropping clusters is worth far more than bottom clears'], intro:'Random bubble shooting in Bubble Pop produces average scores. Systematic cluster planning produces runs 3–5 times longer. The difference is reading the board before each shot rather than reacting to what is directly in front of you.', body:'The cluster planning principle is simple: identify the largest same-color cluster on the board and build a clearing path to it. Every shot should either directly attack the cluster or remove a blocker preventing access. This approach minimizes wasted shots and maximizes the chain clears that produce big scores.', conclusion:'The combo chain is the highest-value move in Bubble Pop — one sequence of cluster clears can produce more points than 20 random shots. Train yourself to pause 2 seconds before each shot and ask: what cluster does this build toward? That pause changes everything.', game_ids:['bubble-pop'], video_search:'bubble pop combo strategy guide tips' },
  { slug:'word-scramble-anagram-guide', title:'Word Scramble Strategy: Solve Anagrams Faster Every Time', excerpt:'Pattern recognition beats random guessing in Word Scramble. Learn the letter patterns that solve 80% of puzzles in under 5 seconds.', meta_description:'Word Scramble strategy guide: anagram solving patterns, common letter combos, and speed techniques. Play free Word Scramble at NEXA Arcade.', keywords:'word scramble tips, how to solve anagrams fast, word scramble strategy, anagram solving techniques, word scramble online free', emoji:'🔤', category:'guides', read_time:4, h2s:['Common Letter Pairs That Unlock Anagrams','The Vowel-First Method for Fast Solving','Building a Mental Pattern Library'], tips:['Look for common pairs: TH, CH, SH, PH, WH first','Identify all vowels and count them — most English words are 40-60% vowels','Try the most common 3-letter endings: -ING, -ION, -ENT, -EST','Rearrange consonants around fixed vowel positions','Short words are often harder — try longer words first'], intro:'Word Scramble separates two types of players: those who rearrange letters randomly and those who recognize patterns instantly. The pattern players solve 5-letter words in 2–3 seconds. Here is how they do it.', body:'The vowel-anchor method is the fastest approach: identify all vowels and fix them mentally as anchor points. Most English words have predictable vowel positions. Once vowels are anchored, consonant clusters fit naturally around them. The TH/CH/SH consonant pairs are the next filter — they almost always stay together in scrambled words.', conclusion:'30 minutes of deliberate practice on 4 and 5-letter anagrams using the vowel-anchor method will build the pattern recognition that carries forward to every word game you play. The skill transfers directly to Wordle, Hangman, and any typing game.', game_ids:['word-scramble','wordle','hangman'], video_search:'word scramble anagram solving tips strategy' },
  { slug:'tile-tap-rhythm-mastery', title:'Tap Tiles Rhythm Guide: How to Hit 200+ Perfect Taps', excerpt:'Tap Tiles is a rhythm game first and a reflex game second. Train your sense of rhythm and your scores will break records.', meta_description:'Tap Tiles strategy: rhythm training, tap timing, and perfect streak techniques. Play free Tap Tiles browser game at NEXA Arcade.', keywords:'tap tiles tips, tap tiles high score, rhythm game strategy, tap tiles online free, timing game guide', emoji:'🟧', category:'guides', read_time:3, h2s:['Rhythm vs Reflex: The Core Distinction','Timing Calibration for Perfect Streaks','Avoiding Fatigue in Long Sessions'], tips:['Listen to the music — the beat tells you when tiles will appear','Tap from the wrist, not the whole hand — less fatigue, more control','Look slightly ahead of the current tile rather than directly at it','Break long sessions with 30-second wrist stretches to avoid strain','Practice the first 30 tiles until they feel automatic, then push further'], intro:'Players who approach Tap Tiles as a reflex game plateau at 100 taps. Players who treat it as a rhythm game regularly break 300. The game is scored to the music — the rhythm IS the guide.', body:'The look-ahead technique is the single biggest improvement most players can make: instead of focusing on the tile you are about to tap, keep your visual attention one tile ahead. This pre-loads the motor response and eliminates the reaction delay that causes misses. Combined with rhythm anticipation rather than visual reaction, your perfect streak length will roughly double.', conclusion:'Tap Tiles is one of the best games for training the timing precision that transfers to music, sports, and other rhythm-dependent skills. Even 10 minutes a day builds measurable timing accuracy within two weeks.', game_ids:['tap-tiles'], video_search:'tap tiles rhythm game tips strategy guide' }
];

async function generateBlogPost(env: Bindings): Promise<void> {
  try {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM blog_posts').first<any>();
    const idx = (count?.n ?? 0) % BLOG_POOL.length;
    const t = BLOG_POOL[idx];
    const now = Date.now();
    const slug = `${t.slug}-${now}`.slice(0, 120);
    const gameLinks = t.game_ids.map(id => `<a href="/games/${id}" style="color:#00e5ff">${id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</a>`).join(', ');
    const tipsHtml = t.tips.map((tip, i) => `<li><strong>${i+1}.</strong> ${tip}</li>`).join('');
    const dateStr = new Date(now).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    const videoSearch = encodeURIComponent((t as any).video_search || t.title);
    const videoEmbed = `<div class="blog-video-wrap" style="margin:28px 0;"><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#0a0a1a;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:12px;" src="https://www.youtube-nocookie.com/embed?listType=search&list=${videoSearch}&rel=0&modestbranding=1" title="Watch: ${t.title}" allowfullscreen loading="lazy"></iframe></div><p style="text-align:center;font-size:12px;color:var(--text-muted,#666);margin-top:8px;">&#x1F4F9; Related gameplay &amp; strategy videos</p></div>`;
    const content = `
<article>
  <header>
    <p class="blog-meta">By ${t.emoji} NEXA Editorial &bull; ${dateStr} &bull; ${t.read_time} min read</p>
    <p class="blog-intro">${t.intro}</p>
  </header>
  ${videoEmbed}
  <section>
    <h2>${t.h2s[0]}</h2>
    <p>${t.body}</p>
  </section>
  <section>
    <h2>${t.h2s[1]}</h2>
    <ul class="blog-tips">${tipsHtml}</ul>
  </section>
  <section>
    <h2>${t.h2s[2]}</h2>
    <p>${t.conclusion}</p>
  </section>
  <section>
    <h2>Play These Games at NEXA Arcade</h2>
    <p>Ready to put these strategies to work? Try: ${gameLinks}. All free, no download, instant play.</p>
  </section>
</article>`;
        await env.DB.prepare(
      `INSERT OR IGNORE INTO blog_posts (slug,title,excerpt,content,category,tags,author,meta_description,meta_keywords,image_emoji,read_time,featured,published_at,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)`
    ).bind(slug, t.title, t.excerpt, content.trim(), t.category, JSON.stringify(t.keywords.split(',')), 'NEXA Editorial', t.meta_description, t.keywords, t.emoji, t.read_time, now, now).run();
  } catch (e) {
    console.error('Blog generation failed:', e);
  }
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
    const hour = new Date().getUTCHours();
    // Every hour: release game spotlight
    await appendHourlySpotlight(env);
    // Every 8 hours (0, 8, 16 UTC): generate a blog post
    if (hour % 8 === 0) {
      ctx.waitUntil(generateBlogPost(env));
    }
    ctx.waitUntil(pingSearchEngines(env));
  },
};
