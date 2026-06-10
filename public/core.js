import { mountBackground, setRoute as setBgRoute } from './bg-3d.js';
import { sfx, attachSfx } from './sfx.js';
import { trackPageView } from './firebase.js';
import { AD_CLIENT, AD_SLOTS, PAID_TIERS } from './ads.js';

export const state = {
  user: null,
  isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  forceVirtual: false,
  hasGamepad: false
};

window.addEventListener('gamepadconnected', () => { state.hasGamepad = true; toast('Gamepad Linked', 'success'); });
window.addEventListener('gamepaddisconnected', () => { state.hasGamepad = false; });

export function h(tag, attrs = {}, ...children) {
  if (typeof tag === 'function') return tag({ ...attrs, children: children.flat(Infinity) });
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class' || k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'ref') typeof v === 'function' && v(el);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v === false || v === null || v === undefined) { }
    else el.setAttribute(k, v);
  }
  const isInteractive = tag === 'button' || tag === 'a';
  if (isInteractive) {
    attachSfx(el);
    if (state.isTouch) el.addEventListener('pointerdown', () => { if (navigator.vibrate) navigator.vibrate(10); });
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
  return el;
}

export async function route(path, push = true) {
  if (push) history.pushState({}, '', path);
  const warp = document.getElementById('warp-overlay');
  if (warp && typeof gsap !== 'undefined') {
    try {
      sfx.transition();
      gsap.set(warp, { visibility: 'visible' });
      await gsap.to(warp, { scale: 1.5, rotate: 0, opacity: 1, duration: 0.5, ease: 'expo.inOut' });
      render(currentRoutes);
      window.scrollTo(0, 0);
      await gsap.to(warp, { scale: 0, rotate: 180, opacity: 0, duration: 0.5, ease: 'expo.inOut' });
      gsap.set(warp, { visibility: 'hidden' });
    } catch {
      gsap.set(warp, { scale: 0, opacity: 0, visibility: 'hidden' });
      render(currentRoutes);
    }
  } else {
    render(currentRoutes);
  }
}

let currentRoutes = [];

function matchRoute(routes, pathname) {
  for (const r of routes) {
    const pathParts = r.path.split('/').filter(Boolean);
    const urlParts = pathname.split('/').filter(Boolean);
    if (pathParts.length !== urlParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i].startsWith(':')) params[pathParts[i].slice(1)] = decodeURIComponent(urlParts[i]);
      else if (pathParts[i] !== urlParts[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

export function setSEO(data = {}) {
  const title = data.title ? data.title + ' | NEXA ARCADE' : 'NEXA ARCADE — Free Browser Games';
  const desc = data.description || 'Play 50+ free browser games with live leaderboards, real-time multiplayer, and tournaments. No downloads required.';
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  let script = document.getElementById('aeo-ld');
  if (!script) { script = document.createElement('script'); script.id = 'aeo-ld'; script.type = 'application/ld+json'; document.head.appendChild(script); }
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': data.type || 'WebApplication',
    name: title, description: desc, url: window.location.href,
    applicationCategory: 'GameApplication', operatingSystem: 'Web',
    author: { '@type': 'Organization', name: 'NEXA Studios' },
    ...(data.extra || {})
  });
}

export function render(routes) {
  currentRoutes = routes;
  const app = document.getElementById('app');
  app.innerHTML = '';
  const url = new URL(location.href);
  const match = matchRoute(routes, url.pathname);
  try { mountBackground(); setBgRoute(url.pathname); } catch {}
  setSEO();

  const lastPulse = localStorage.getItem('nexa_last_pulse');
  const today = new Date().toDateString();
  if (lastPulse !== today) {
    localStorage.setItem('nexa_last_pulse', today);
    if (state.user) {
      api('/api/daily-pulse', { method: 'POST' }).then(res => {
        if (res.ok) toast('+' + res.reward + ' Credits Synced', 'success');
      }).catch(() => {});
    }
  }

  app.appendChild(buildHeader(url.pathname));
  const main = document.createElement('main');
  if (!match) main.appendChild(NotFound());
  else {
    const view = match.route.view({ params: match.params, query: url.searchParams });
    main.appendChild(view);
  }
  app.appendChild(main);
  app.appendChild(buildFooter());
  initScrollAnimations();
  wireLinks(app);
  trackPageView(url.pathname);
}

function initScrollAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    document.querySelectorAll('.reveal-text, .reveal-card').forEach(el => {
      el.style.opacity = '1'; el.style.transform = 'none';
    });
    return;
  }
  try {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.reveal-text').forEach((el, i) => {
      gsap.fromTo(el, { opacity: 0, y: 20 }, {
        opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', delay: i * 0.06,
        scrollTrigger: { trigger: el, start: 'top 96%', toggleActions: 'play none none none' }
      });
    });
    gsap.utils.toArray('.reveal-card').forEach((el, i) => {
      gsap.fromTo(el, { opacity: 0, y: 16 }, {
        opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: i * 0.04,
        scrollTrigger: { trigger: el, start: 'top 96%', toggleActions: 'play none none none' }
      });
    });
    const header = document.querySelector('.site-header');
    if (header) {
      ScrollTrigger.create({
        start: 'top -50',
        onUpdate: (self) => {
          header.classList.toggle('scrolled', self.direction === 1 || self.scroll() > 50);
        }
      });
    }
    ScrollTrigger.refresh();
  } catch (e) { console.error('GSAP:', e); }
}

function wireLinks(root) {
  root.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) return;
      e.preventDefault();
      route(href);
    });
  });
}

function buildHeader(currentPath) {
  const user = state.user;
  const toggle = h('button', { class: 'nav-toggle', 'aria-label': 'Menu', 'aria-expanded': 'false' },
    h('span'), h('span'), h('span')
  );
  const mobileNav = h('nav', { class: 'mobile-nav', 'aria-label': 'Mobile navigation' },
    h('a', { href: '/games', 'data-link': true }, 'Games'),
    h('a', { href: '/arena', 'data-link': true }, 'Arena'),
    h('a', { href: '/tournaments', 'data-link': true }, 'Tournaments'),
    h('a', { href: '/leaderboards', 'data-link': true }, 'Legends'),
    h('a', { href: '/blog', 'data-link': true }, 'Blog'),
    h('a', { href: '/creators', 'data-link': true }, 'Studio'),
    h('a', { href: '/shop', 'data-link': true }, 'Shop'),
    user
      ? h('a', { href: '/account', 'data-link': true, class: 'btn btn-primary' }, user.username)
      : h('a', { href: '/signup', 'data-link': true, class: 'btn btn-primary' }, 'Join Free')
  );
  toggle.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
  const navItems = [
    ['/', 'Games', '/games'],
    ['/arena', 'Arena', '/arena'],
    ['/tournaments', 'Tournaments', '/tournaments'],
    ['/leaderboards', 'Legends', '/leaderboards'],
    ['/blog', 'Blog', '/blog'],
    ['/creators', 'Studio', '/creators'],
  ];
  return h('header', { class: 'site-header' },
    h('div', { class: 'container nav' },
      h('a', { href: '/', 'data-link': true, class: 'brand' }, 'NEXA'),
      h('ul', { class: 'nav-links', role: 'navigation', 'aria-label': 'Main navigation' },
        ...navItems.map(([, label, href]) =>
          h('li', {}, h('a', { href, 'data-link': true, class: currentPath.startsWith(href) && href !== '/' ? 'active' : '' }, label))
        )
      ),
      h('div', { class: 'nav-right' },
        user
          ? h('a', { href: '/account', 'data-link': true, class: 'btn btn-sm' }, user.username)
          : h('a', { href: '/signup', 'data-link': true, class: 'btn btn-sm btn-primary' }, 'Join Free'),
        toggle
      )
    ),
    mobileNav
  );
}

function buildFooter() {
  return h('footer', { class: 'site-footer' },
    h('div', { class: 'container' },
      h('div', { class: 'footer-grid' },
        h('div', {},
          h('div', { class: 'footer-brand' }, 'NEXA'),
          h('p', { class: 'footer-tagline' }, '50+ free browser games. Real leaderboards. Live tournaments. No downloads required.')
        ),
        h('div', { class: 'footer-col' },
          h('h4', {}, 'Play'),
          h('ul', {},
            h('li', {}, h('a', { href: '/games', 'data-link': true }, 'All Games')),
            h('li', {}, h('a', { href: '/arena', 'data-link': true }, 'Live Arena')),
            h('li', {}, h('a', { href: '/tournaments', 'data-link': true }, 'Tournaments')),
            h('li', {}, h('a', { href: '/leaderboards', 'data-link': true }, 'Leaderboards')),
            h('li', {}, h('a', { href: '/blog', 'data-link': true }, 'Gaming Blog')),
            h('li', {}, h('a', { href: '/governance', 'data-link': true }, 'Vote on Games'))
          )
        ),
        h('div', { class: 'footer-col' },
          h('h4', {}, 'Account'),
          h('ul', {},
            h('li', {}, h('a', { href: '/signup', 'data-link': true }, 'Sign Up Free')),
            h('li', {}, h('a', { href: '/login', 'data-link': true }, 'Login')),
            h('li', {}, h('a', { href: '/shop', 'data-link': true }, 'Shop')),
            h('li', {}, h('a', { href: '/creators', 'data-link': true }, 'Creator Studio')),
            h('li', {}, h('a', { href: '/account', 'data-link': true }, 'My Profile'))
          )
        ),
        h('div', { class: 'footer-col' },
          h('h4', {}, 'Company'),
          h('ul', {},
            h('li', {}, h('a', { href: '/about', 'data-link': true }, 'About')),
            h('li', {}, h('a', { href: '/contact', 'data-link': true }, 'Contact')),
            h('li', {}, h('a', { href: '/privacy', 'data-link': true }, 'Privacy Policy')),
            h('li', {}, h('a', { href: '/terms', 'data-link': true }, 'Terms of Service')),
            h('li', {}, h('a', { href: '/cookies', 'data-link': true }, 'Cookies'))
          )
        )
      ),
      h('div', { class: 'footer-bottom' },
        h('p', { class: 'footer-copy' }, '© 2026 NEXA Arcade. All rights reserved.'),
        h('div', { class: 'footer-legal' },
          h('a', { href: '/privacy', 'data-link': true }, 'Privacy'),
          h('a', { href: '/terms', 'data-link': true }, 'Terms'),
          h('a', { href: '/cookies', 'data-link': true }, 'Cookies')
        )
      )
    )
  );
}

function NotFound() {
  return h('div', { class: 'container section', style: 'text-align:center;padding-top:200px;' },
    h('div', { style: 'font-size:64px;margin-bottom:24px;' }, '🕹️'),
    h('h1', { style: 'font-family:var(--font-display);font-size:48px;margin-bottom:12px;' }, '404'),
    h('p', { style: 'color:var(--text-dim);margin-bottom:32px;' }, "This grid sector doesn't exist."),
    h('a', { href: '/', 'data-link': true, class: 'btn btn-primary' }, 'Return to Base')
  );
}

export function ensureToastContainer() {
  if (document.getElementById('toast-container')) return;
  const c = document.createElement('div');
  c.id = 'toast-container'; c.className = 'toast-container';
  document.body.appendChild(c);
}

export function toast(message, type = '') {
  ensureToastContainer();
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(10px)'; }, 3000);
  setTimeout(() => t.remove(), 3500);
}

/**
 * Render a real, responsive AdSense display unit.
 * @param {string} slot  A key from AD_SLOTS ('inContent'|'inArticle'|'sidebar')
 *                       or a raw numeric data-ad-slot id.
 * Returns null when the viewer is a subscriber or no slot id is configured —
 * so there are never empty "Advertisement" placeholder boxes. Sitewide
 * Auto Ads still earn regardless of these manual units.
 */
export function AdSlot(slot = 'inContent', label = 'Advertisement') {
  if (state.user && PAID_TIERS.includes(state.user.tier)) return null;
  const slotId = AD_SLOTS[slot] || (/^\d{6,}$/.test(slot) ? slot : '');
  if (!slotId) return null;
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle'; ins.style.display = 'block';
  ins.setAttribute('data-ad-client', AD_CLIENT);
  ins.setAttribute('data-ad-slot', slotId);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  queueMicrotask(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {} });
  return h('div', { class: 'ad-zone', 'aria-label': label }, ins);
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  });
  let json = {}; try { json = await res.json(); } catch {}
  if (!res.ok) throw new Error(json.error || 'HTTP ' + res.status);
  return json;
}

window.addEventListener('mousedown', () => { try { sfx.startAmbient(); } catch {} }, { once: true });
window.addEventListener('keydown', () => { try { sfx.startAmbient(); } catch {} }, { once: true });
