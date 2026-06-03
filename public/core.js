import { mountBackground, setRoute as setBgRoute } from './bg-3d.js';
import { sfx, attachSfx } from './sfx.js';

export const state = { 
  user: null,
  isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  forceVirtual: false,
  hasGamepad: false
};

window.addEventListener("gamepadconnected", () => { state.hasGamepad = true; toast('Gamepad Linked', 'success'); });
window.addEventListener("gamepaddisconnected", () => { state.hasGamepad = false; });

// Hyperscript with auto-SFX attachment
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
    else if (v === false || v === null || v === undefined) { /* skip */ }
    else el.setAttribute(k, v);
  }
  
  // Auto-attach SFX and Haptics to interactive elements
  const isInteractive = tag === 'button' || tag === 'a' || (attrs && (attrs.class || '').includes('btn') || (attrs && (attrs.class || '').includes('game-card')));
  if (isInteractive) {
    attachSfx(el);
    if (state.isTouch) {
      el.addEventListener('pointerdown', () => { if (navigator.vibrate) navigator.vibrate(10); });
    }
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
  
  // Page Warp Transition
  const warp = document.getElementById('warp-overlay');
  if (warp && typeof gsap !== 'undefined') {
    try {
      sfx.transition();
      gsap.set(warp, { visibility: 'visible' });
      await gsap.to(warp, { scale: 1.5, rotate: 0, opacity: 1, duration: 0.8, ease: 'expo.inOut' });
      render(currentRoutes);
      window.scrollTo(0, 0);
      await gsap.to(warp, { scale: 0, rotate: 180, opacity: 0, duration: 0.8, ease: 'expo.inOut' });
      gsap.set(warp, { visibility: 'hidden' });
    } catch (e) {
      console.error("Transition Error:", e);
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
  const title = data.title ? `${data.title} | NEXA ARCADE` : 'NEXA ARCADE | The Future of Gaming';
  const desc = data.description || 'Experience the next evolution of browser gaming. High-performance, zero-friction, premium arcade console in your browser.';
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  
  // Inject JSON-LD for AEO (Answer Engine Optimization)
  let script = document.getElementById('aeo-ld');
  if (!script) {
    script = document.createElement('script');
    script.id = 'aeo-ld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  
  const ld = {
    "@context": "https://schema.org",
    "@type": data.type || "WebApplication",
    "name": title,
    "description": desc,
    "url": window.location.href,
    "applicationCategory": "GameApplication",
    "operatingSystem": "Web",
    "author": { "@type": "Organization", "name": "NEXA Studios" },
    ...data.extra
  };
  script.textContent = JSON.stringify(ld);
}

export function render(routes) {
  currentRoutes = routes;
  const app = document.getElementById('app');
  app.innerHTML = '';
  const url = new URL(location.href);
  const match = matchRoute(routes, url.pathname);

  try { mountBackground(); setBgRoute(url.pathname); } catch {}

  // Standard Page Metadata
  setSEO();

  // Daily Neural Pulse: Retention Logic
  const lastPulse = localStorage.getItem('nexa_last_pulse');
  const today = new Date().toDateString();
  if (lastPulse !== today) {
    localStorage.setItem('nexa_last_pulse', today);
    if (state.user) {
      api('/api/daily-pulse', { method: 'POST' }).then(res => {
        if (res.ok) toast(`Daily Pulse Synchronized: +${res.reward} Credits`, 'success');
      });
    }
  }

  app.appendChild(Header());
  const main = document.createElement('main');
  if (!match) main.appendChild(NotFound());
  else {
    const view = match.route.view({ params: match.params, query: url.searchParams });
    main.appendChild(view);
  }
  app.appendChild(main);
  app.appendChild(Footer());
  
  initScrollAnimations();
  wireLinks(app);
}

function initScrollAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  
  try {
    gsap.registerPlugin(ScrollTrigger);
    
    // Reveal Text
    gsap.utils.toArray('.reveal-text').forEach(el => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 95%', toggleActions: 'play none none none' }
      });
    });

    // Reveal Cards
    gsap.utils.toArray('.reveal-card').forEach((el, i) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: 'expo.out', delay: i * 0.05,
        scrollTrigger: { trigger: el, start: 'top 95%', toggleActions: 'play none none none' }
      });
    });

    // Sticky Header Logic
    const header = document.querySelector('.site-header');
    if (header) {
      ScrollTrigger.create({
        start: 'top -50',
        onUpdate: (self) => {
          if (self.direction === 1) header.classList.add('scrolled');
          else if (self.scroll() < 50) header.classList.remove('scrolled');
        }
      });
    }
    
    // Force refresh to catch elements already in view
    ScrollTrigger.refresh();
  } catch (e) { console.error("GSAP Error:", e); }
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

function Header() {
  const user = state.user;
  return h('header', { class: 'site-header' },
    h('div', { class: 'container nav' },
      h('a', { href: '/', 'data-link': true, class: 'brand' }, 'NEXA'),
      h('nav', { class: 'nav-links' },
        h('a', { href: '/games', 'data-link': true }, 'Games'),
        h('a', { href: '/arena', 'data-link': true }, 'Live Arena'),
        h('a', { href: '/tournaments', 'data-link': true }, 'Tournaments'),
        h('a', { href: '/leaderboards', 'data-link': true }, 'Legends'),
        h('a', { href: '/creators', 'data-link': true }, 'Studio'),
      ),
      h('div', { class: 'nav-cta' },
        user
          ? h('a', { href: '/account', 'data-link': true, class: 'btn btn-sm' }, user.username)
          : h('a', { href: '/login', 'data-link': true, class: 'btn btn-sm btn-primary' }, 'Join Now')
      )
    )
  );
}

function Footer() {
  const links = [
    ['/games', 'Games'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms'],
    ['/cookies', 'Cookies'],
  ];
  return h('footer', { class: 'site-footer' },
    h('div', { class: 'container', style: 'text-align: center;' },
      h('div', { class: 'brand', style: 'font-size: 40px; margin-bottom: 20px;' }, 'NEXA ARCADE'),
      h('nav', { class: 'footer-links', 'aria-label': 'Footer' },
        ...links.map(([href, label]) => h('a', { href, 'data-link': true }, label))
      ),
      h('p', { style: 'color: var(--text-dim); font-size: 14px; margin-top: 20px;' }, '© 2026 Nexa Arcade. The Future of Gaming on Cloudflare.')
    )
  );
}

function NotFound() {
  return h('div', { class: 'container section' }, h('h1', {}, '404'), h('a', { href: '/', 'data-link': true, class: 'btn' }, 'Back Home'));
}

export function ensureToastContainer() {
  if (document.getElementById('toast-container')) return;
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container';
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

// Real AdSense publisher ID. Configure per-unit slot IDs via window.NEXA_AD_SLOTS
// (a { '728x90': '1234567890', ... } map) once units are created in AdSense.
// Until a real slot ID exists for a unit, we render NOTHING here — Google Auto Ads
// (loaded globally in index.html) still place ads automatically. We never display a
// fake "Sponsored" placeholder box, which would violate AdSense policy.
const AD_CLIENT = 'ca-pub-5800977493749262';

export function AdSlot(size = '728x90', label = 'Advertisement', slotId = '') {
  // AD-FREE logic for paid tiers
  if (state.user && ['operative', 'pro', 'legend', 'studio'].includes(state.user.tier)) {
    return h('div', { class: 'ad-slot-hidden', style: 'display:none;' });
  }
  // Resolve slot id: explicit arg wins, else look up a configured map by size.
  const resolved = slotId || (window.NEXA_AD_SLOTS && window.NEXA_AD_SLOTS[size]) || '';
  if (!resolved) {
    // No real ad unit configured yet — render nothing (Auto Ads still serve).
    return h('div', { class: 'ad-slot-hidden', style: 'display:none;' });
  }
  const wrap = h('div', { class: 'ad-slot', 'aria-label': label });
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.style.width = '100%';
  ins.setAttribute('data-ad-client', AD_CLIENT);
  ins.setAttribute('data-ad-slot', resolved);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  wrap.appendChild(ins);
  queueMicrotask(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {} });
  return wrap;
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  });
  let json = {}; try { json = await res.json(); } catch {}
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// Global interaction to unlock audio
window.addEventListener('mousedown', () => { try { sfx.startAmbient(); } catch(e) {} }, { once: true });
window.addEventListener('keydown', () => { try { sfx.startAmbient(); } catch(e) {} }, { once: true });