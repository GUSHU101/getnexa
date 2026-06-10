import { h, api, AdSlot, state, toast, route } from '../core.js';
import { trackEvent } from '../firebase.js';
import { GAMES, findGame } from '../games/index.js';
import { setAdaptiveTheme } from '../bg-3d.js';
import { playSpecificSong } from '../music-player.js';

/* ── Category definitions ── */
const CATEGORIES = {
  all:        { label: 'All Games',       emoji: '🎮' },
  new:        { label: 'New',             emoji: '⭐' },
  action:     { label: 'Action',          emoji: '🚀', ids: ['neondrift','starblitz','fruit-slicer','whack-a-mole','emoji-catcher','insect-catch','shape-clicker','archery','balloon-pop','asteroid-dash','reaction-test','tap-tiles','breakout','snake'] },
  puzzle:     { label: 'Puzzle',          emoji: '🧩', ids: ['2048','2048-ext','tetris','tetris-ext','memory','memory-ext','minesweeper','minesweeper-ext','wordle','hangman','sudoku','tilting-maze','sliding-puzzle','hextris','tower-blocks','connect-four','number-guess','simon-says','color-flash','bubble-pop','math-blitz'] },
  arcade:     { label: 'Arcade',          emoji: '🕹️', ids: ['snake','snake-ext','breakout','breakout-ext','pong','ping-pong','flappy-bird','pacman','doodle-jump','crossy-road','candy-crush','insect-catch','shape-clicker','balloon-pop','tap-tiles','fruit-slicer'] },
  racing:     { label: 'Racing',          emoji: '🏎️', ids: ['neondrift','aviator','starblitz','asteroid-dash','flappy-bird','crossy-road','doodle-jump','balloon-pop','tap-tiles','reaction-test'] },
  strategy:   { label: 'Strategy',        emoji: '⚔️', ids: ['chess','tictactoe','tictactoe-ext','solitaire','rps','dice-roll','math-blitz','word-scramble','connect-four','number-guess','sudoku','quiz'] },
  word:       { label: 'Word & Typing',   emoji: '⌨️', ids: ['wordle','hangman','speed-typing','typing-hero','typing-pro','quiz','speak-guess','word-scramble','number-guess','math-blitz'] },
  multiplayer:{ label: 'Multiplayer',     emoji: '👥', ids: ['tictactoe','tictactoe-ext','pong','ping-pong','chess','connect-four','rps','wordle'] },
  card:       { label: 'Card & Board',    emoji: '🃏', ids: ['solitaire','chess','dice-roll','rps','connect-four','tictactoe','tictactoe-ext','memory','memory-ext','number-guess'] },
};

/* Color palettes for carousel rings — 10 slots */
const RING_COLORS = [
  '142,249,252','142,252,204','142,252,157','215,252,142','252,252,142',
  '252,208,142','252,142,142','252,142,239','204,142,252','142,202,252',
];

/* Cache video list once */
let _videosCache = null;
function getVideos() {
  if (_videosCache) return Promise.resolve(_videosCache);
  return fetch('/Videos/videos.json').then(r => r.json()).then(v => { _videosCache = v; return v; }).catch(() => []);
}

/* ── 3-D Carousel for one group of games ── */
function GameCarousel(games, label, emoji) {
  const qty = Math.min(games.length, 10);
  const inner = h('div', { class: 'carousel-inner', style: `--quantity:${qty}` });

  games.slice(0, qty).forEach((game, i) => {
    const color = RING_COLORS[i % RING_COLORS.length];
    const video = document.createElement('video');
    video.className = 'carousel-card-video';
    video.muted = true; video.loop = true; video.playsInline = true;
    getVideos().then(v => { if (v.length) video.src = '/Videos/' + v[i % v.length]; });

    const card = h('div', {
      class: 'carousel-card',
      style: `--index:${i};--color-card:${color}`,
      role: 'button', tabIndex: 0,
      'aria-label': 'Play ' + game.name,
      onClick: () => route('/games/' + game.id),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); route('/games/' + game.id); } }
    },
      video,
      game.new  && h('div', { class: 'carousel-card-badge-new' }, 'NEW'),
      game.multiplayer && h('div', { class: 'carousel-card-badge-mp' }, '2P'),
      h('div', { class: 'carousel-card-emoji' }, game.emoji),
      h('div', { class: 'carousel-card-name' }, game.name)
    );

    card.addEventListener('mouseenter', () => {
      inner.classList.add('hover-paused');
      video.play().catch(() => {});
      if (game.song) playSpecificSong(game.song);
      if (game.theme !== undefined) setAdaptiveTheme([0x7c5cff,0xff5b6b,0x24d1a1,0xffb020,0x00d1ff][game.theme] || 0x00f3ff);
    });
    card.addEventListener('mouseleave', () => {
      inner.classList.remove('hover-paused');
      video.pause();
      setAdaptiveTheme(0x00f3ff);
    });

    inner.appendChild(card);
  });

  return h('div', { class: 'carousel-section' },
    h('div', { class: 'carousel-section-hdr' },
      h('span', {}, emoji + '  ' + label),
      h('em', {}, games.length + ' games')
    ),
    h('div', { class: 'carousel-wrapper' }, inner)
  );
}

/* ── GameCard (used in search/grid mode) ── */
const GAME_COLORS = [
  ['#1a0a3a','#0a0a2a','#7c3aed'],['#0a1a2e','#0a0a1a','#00e5ff'],
  ['#0a1a0a','#0a1a10','#10b981'],['#1a1a0a','#1a0f0a','#f59e0b'],
  ['#2a0a0a','#1a0a0a','#ef4444'],['#0a0a2a','#10082a','#a855f7'],
  ['#0a1a1a','#0a1210','#06b6d4'],['#1a0a10','#2a0a18','#f0abfc'],
];
export function GameCard(game, index = 0) {
  const [c1, c2, glow] = GAME_COLORS[index % GAME_COLORS.length];
  const video = document.createElement('video');
  video.className = 'game-card-video'; video.muted = true; video.loop = true; video.playsInline = true;
  getVideos().then(v => { if (v.length) video.src = '/Videos/' + v[index % v.length]; });

  const badge = game.new  ? h('div', { class: 'game-card-badge new' }, 'NEW')
    : game.multiplayer    ? h('div', { class: 'game-card-badge mp' }, '2P')
    : null;

  const card = h('div', {
    class: 'game-card reveal-card',
    style: '--c1:' + c1 + ';--c2:' + c2 + ';--glow-color:' + glow,
    role: 'button', tabIndex: 0, 'aria-label': 'Play ' + game.name,
    onClick: () => { card.classList.add('spin-active'); setTimeout(() => route('/games/' + game.id), 300); },
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); route('/games/' + game.id); } }
  },
    h('div', { class: 'game-card-bg' }), video, badge,
    h('div', { class: 'player-count' }, h('span', { class: 'pulse-dot' }), 'LIVE'),
    h('div', { class: 'game-card-glow' }),
    h('div', { class: 'game-card-art' }, game.emoji),
    h('div', { class: 'game-card-info' }, h('h3', {}, game.name), h('p', {}, game.short))
  );
  card.addEventListener('mouseenter', () => {
    video.play().catch(() => {});
    if (game.theme !== undefined) setAdaptiveTheme([0x7c5cff,0xff5b6b,0x24d1a1,0xffb020,0x00d1ff][game.theme] || 0x00f3ff);
    if (game.song) playSpecificSong(game.song);
  });
  card.addEventListener('mouseleave', () => { video.pause(); setAdaptiveTheme(0x00f3ff); });
  return card;
}

/* ── Activity ticker ── */
function GlobalActivityTicker() {
  const content = h('span', { class: 'ticker-content' }, '⚡ NEXA GRID ACTIVE — MISSIONS IN PROGRESS...');
  const el = h('div', { class: 'activity-ticker' }, h('div', { class: 'container' }, content));
  const update = () => {
    api('/api/stats/real-time').then(data => {
      if (!data.activity?.length) return;
      content.innerHTML = data.activity.map(a =>
        '⚡ <strong>' + a.username + '</strong> scored ' + Number(a.score).toLocaleString() + ' in ' + a.game_id
      ).join(' &nbsp;•&nbsp; ');
    }).catch(() => {});
  };
  setInterval(update, 30000); update();
  return el;
}

/* ── Games Page ── */
export function GamesPage({ query }) {
  let currentCat = query?.get('cat') || 'all';
  let searchQ = query?.get('q') || '';

  /* ------ search grid ------ */
  const searchGrid = h('div', { class: 'games-grid-search' });

  function updateSearchGrid(q) {
    searchGrid.innerHTML = '';
    const filtered = GAMES.filter(g =>
      g.name.toLowerCase().includes(q) || g.short.toLowerCase().includes(q)
    );
    filtered.forEach((g, i) => searchGrid.appendChild(GameCard(g, i)));
    // GSAP animate if available
    if (typeof gsap !== 'undefined') {
      try {
        gsap.utils.toArray(searchGrid.children).forEach((el, i) =>
          gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out', delay: i * 0.025 })
        );
      } catch {}
    } else {
      Array.from(searchGrid.children).forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    }
  }

  /* ------ build carousels ------ */
  function buildCarousels(cat) {
    const stack = h('div', { class: 'carousels-stack' });

    const groups = cat === 'all'
      ? [
          { key: 'new',        label: 'New Releases', emoji: '⭐', games: GAMES.filter(g => g.new) },
          { key: 'action',     label: 'Action',       emoji: '🚀', games: GAMES.filter(g => CATEGORIES.action.ids?.includes(g.id)) },
          { key: 'puzzle',     label: 'Puzzle',        emoji: '🧩', games: GAMES.filter(g => CATEGORIES.puzzle.ids?.includes(g.id)) },
          { key: 'arcade',     label: 'Arcade',        emoji: '🕹️', games: GAMES.filter(g => CATEGORIES.arcade.ids?.includes(g.id)) },
          { key: 'strategy',   label: 'Strategy',      emoji: '⚔️', games: GAMES.filter(g => CATEGORIES.strategy.ids?.includes(g.id)) },
          { key: 'word',       label: 'Word & Typing', emoji: '⌨️', games: GAMES.filter(g => CATEGORIES.word.ids?.includes(g.id)) },
          { key: 'card',       label: 'Card & Board',  emoji: '🃏', games: GAMES.filter(g => CATEGORIES.card.ids?.includes(g.id)) },
          { key: 'multiplayer',label: 'Multiplayer',   emoji: '👥', games: GAMES.filter(g => g.multiplayer) },
        ]
      : cat === 'new'
        ? [{ key: 'new', label: 'New Releases', emoji: '⭐', games: GAMES.filter(g => g.new) }]
        : cat === 'multiplayer'
          ? [{ key: 'multiplayer', label: 'Multiplayer', emoji: '👥', games: GAMES.filter(g => g.multiplayer) }]
          : [{ key: cat, label: CATEGORIES[cat]?.label || cat, emoji: CATEGORIES[cat]?.emoji || '🎮',
               games: CATEGORIES[cat]?.ids ? GAMES.filter(g => CATEGORIES[cat].ids.includes(g.id)) : GAMES }];

    groups.filter(g => g.games.length > 0).forEach(g => {
      // Build multiple carousels if group has >10 games
      const chunks = [];
      for (let i = 0; i < g.games.length; i += 10) chunks.push(g.games.slice(i, i + 10));
      chunks.forEach((chunk, ci) => {
        const label = chunks.length > 1 ? g.label + ' — Vol.' + (ci + 1) : g.label;
        stack.appendChild(GameCarousel(chunk, label, g.emoji));
      });
    });
    return stack;
  }

  /* ------ page scaffold ------ */
  const carouselWrap = h('div', {});
  carouselWrap.appendChild(buildCarousels(currentCat));

  const pageWrap = h('div', { class: 'no-search' });

  const countEl = h('span', { style: 'color:var(--text-muted);font-size:13px;font-family:var(--font-display);' }, GAMES.length + ' GAMES');

  const searchInput = h('input', {
    type: 'search', class: 'search', placeholder: 'Search games...',
    value: searchQ,
    onInput: (e) => {
      const q = e.target.value.toLowerCase().trim();
      searchQ = q;
      if (q) {
        pageWrap.classList.add('search-active');
        pageWrap.classList.remove('no-search');
        updateSearchGrid(q);
        countEl.textContent = GAMES.filter(g => g.name.toLowerCase().includes(q) || g.short.toLowerCase().includes(q)).length + ' GAMES';
      } else {
        pageWrap.classList.remove('search-active');
        pageWrap.classList.add('no-search');
        countEl.textContent = GAMES.length + ' GAMES';
      }
    }
  });

  const pills = h('div', { class: 'cat-pills' },
    ...Object.entries(CATEGORIES).map(([key, cat]) =>
      h('button', {
        class: 'cat-pill' + (currentCat === key ? ' active' : ''),
        onClick: (e) => {
          pills.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
          e.target.classList.add('active');
          currentCat = key;
          searchInput.value = '';
          searchQ = '';
          pageWrap.classList.remove('search-active');
          pageWrap.classList.add('no-search');
          countEl.textContent = GAMES.length + ' GAMES';
          carouselWrap.innerHTML = '';
          carouselWrap.appendChild(buildCarousels(key));
        }
      }, cat.emoji + ' ' + cat.label)
    )
  );

  if (searchQ) {
    pageWrap.classList.add('search-active');
    pageWrap.classList.remove('no-search');
    updateSearchGrid(searchQ);
  }

  pageWrap.appendChild(GlobalActivityTicker());
  pageWrap.appendChild(h('div', { class: 'container section' },
    h('div', { class: 'section-head-row' },
      h('div', {},
        h('div', { class: 'eyebrow' }, 'The Archive'),
        h('h1', { style: 'font-family:var(--font-display);font-size:clamp(28px,5vw,52px);font-weight:800;letter-spacing:-.02em;margin-bottom:8px;' }, 'All Games'),
        countEl
      ),
      h('div', { class: 'search-wrap' }, searchInput)
    ),
    pills,
    AdSlot('inContent'),
    h('div', { style: 'margin-top:24px;' }, carouselWrap),
    searchGrid
  ));

  return pageWrap;
}

/* ── Loot Box ── */
function LootBoxModal(onClose) {
  const rewards = [
    { id: 'skin_neon', name: 'NEON GHOST SKIN', icon: '👤', rarity: 'RARE' },
    { id: 'skin_gold', name: 'GOLDEN VANGUARD', icon: '🛡️', rarity: 'EPIC' },
    { id: 'rank_boost', name: '2X RANK BOOST', icon: '⚡', rarity: 'UNCOMMON' },
    { id: 'custom_crosshair', name: 'PRECISION CORE', icon: '🎯', rarity: 'RARE' },
  ];
  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  const boxRef = {};
  const el = h('div', { class: 'loot-overlay' },
    h('div', { class: 'loot-container', ref: (e) => boxRef.el = e },
      h('div', { class: 'loot-box-visual' }, '🎁'),
      h('h2', { style: 'font-family:var(--font-display);margin-bottom:8px;' }, 'NEURAL CACHE'),
      h('p', { style: 'color:var(--text-dim);margin-bottom:28px;font-size:14px;' }, 'Decrypting tactical assets...'),
      h('button', { class: 'btn btn-primary btn-block', onClick: (ev) => {
        const btn = ev.target; btn.disabled = true; btn.textContent = 'DECRYPTING...';
        if (typeof gsap !== 'undefined' && boxRef.el) gsap.to(boxRef.el, { x: 8, repeat: 8, duration: 0.06, yoyo: true });
        api('/api/inventory/add', { method: 'POST', body: { item_id: reward.id } }).catch(() => {});
        setTimeout(() => {
          if (!boxRef.el) return;
          boxRef.el.innerHTML = '';
          const reveal = h('div', { class: 'reward-reveal' },
            h('div', { class: 'reward-icon' }, reward.icon),
            h('div', { class: 'reward-rarity' }, reward.rarity),
            h('h3', { style: 'font-family:var(--font-display);' }, reward.name),
            h('p', { style: 'color:var(--cyan);margin-top:8px;font-size:13px;' }, 'ASSET SYNCHRONIZED'),
            h('button', { class: 'btn btn-block', style: 'margin-top:20px;', onClick: onClose }, 'Accept')
          );
          boxRef.el.appendChild(reveal);
          if (typeof gsap !== 'undefined') gsap.from(reveal, { scale: 0.5, opacity: 0, duration: 0.5, ease: 'back.out' });
        }, 1000);
      }}, 'INITIATE DECRYPTION')
    )
  );
  return el;
}

/* ── Virtual D-Pad ──
   Native games listen on the parent window; external games run inside a
   same-origin iframe and only see events fired into THEIR window/document.
   So we forward every synthetic key to both targets, with real keyCodes
   (many older games still read e.keyCode / e.which). */
const KEY_CODES = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32 };
const KEY_NAMES = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ' ': 'Space' };

function makeKeyEvent(type, key) {
  const code = KEY_CODES[key] || 0;
  const ev = new KeyboardEvent(type, { key, code: KEY_NAMES[key] || key, bubbles: true, cancelable: true });
  // KeyboardEvent ctor ignores keyCode/which — force them for legacy games
  try { Object.defineProperty(ev, 'keyCode', { get: () => code }); Object.defineProperty(ev, 'which', { get: () => code }); } catch {}
  return ev;
}

export function dispatchGameKey(key, type) {
  window.dispatchEvent(makeKeyEvent(type, key));
  document.dispatchEvent(makeKeyEvent(type, key));
  const ifr = document.querySelector('.game-stage iframe');
  if (ifr && ifr.contentWindow) {
    try {
      ifr.contentWindow.dispatchEvent(makeKeyEvent(type, key));
      const doc = ifr.contentDocument;
      if (doc) (doc.activeElement || doc.body || doc).dispatchEvent(makeKeyEvent(type, key));
    } catch {}
  }
}

function VirtualControls() {
  const btn = (cls, label, key, glyph) => h('button', {
    class: 'v-btn ' + cls, 'aria-label': label,
    onPointerDown: (e) => { e.preventDefault(); dispatchGameKey(key, 'keydown'); },
    onPointerUp: (e) => { e.preventDefault(); dispatchGameKey(key, 'keyup'); },
    onContextMenu: (e) => e.preventDefault(),
  }, glyph);
  return h('div', { class: 'virtual-controls', 'aria-label': 'Game controls', role: 'group' },
    h('div', { class: 'dpad' },
      btn('v-up', 'Up', 'ArrowUp', '▲'),
      btn('v-left', 'Left', 'ArrowLeft', '◀'),
      btn('v-right', 'Right', 'ArrowRight', '▶'),
      btn('v-down', 'Down', 'ArrowDown', '▼'),
    ),
    h('div', { class: 'action-btns' },
      btn('v-action', 'Action', ' ', '⚡')
    )
  );
}

/* ── Game Page ── */
export function GamePage({ params }) {
  const game = findGame(params.id);
  if (!game) {
    return h('div', { class: 'container section', style: 'text-align:center;padding-top:160px;' },
      h('h1', { style: 'font-family:var(--font-display);font-size:40px;margin-bottom:16px;' }, 'Game Not Found'),
      h('a', { href: '/games', 'data-link': true, class: 'btn btn-primary' }, '← All Games')
    );
  }

  const stageRef = {};
  const loader = h('div', { class: 'game-loader-overlay' },
    h('div', { class: 'loader-name' }, (state.user?.username || 'ANONYMOUS').toUpperCase()),
    h('div', { class: 'loader-ready' }, 'LOADING ' + game.name.toUpperCase() + '...'),
    h('div', { class: 'loader-bar' })
  );
  document.body.appendChild(loader);

  const pauseOverlay = h('div', { class: 'pause-overlay', style: 'display:none;' },
    h('div', { class: 'pause-menu' },
      h('h2', {}, 'PAUSED'),
      h('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:12px;',
        onClick: () => { pauseOverlay.style.display = 'none'; stageRef.el?.focus(); }
      }, 'Resume'),
      h('button', { class: 'btn btn-block', onClick: () => route('/games') }, 'Quit to Menu')
    )
  );

  const lbPanel = h('div', { class: 'panel' },
    h('h3', {}, 'Top Scores'),
    h('div', { id: 'lb-list' }, h('div', { style: 'color:var(--text-muted);font-size:13px;' }, 'Loading...'))
  );
  api('/api/scores/leaderboard/' + game.id).then(data => {
    const lb = lbPanel.querySelector('#lb-list');
    lb.innerHTML = '';
    if (!data.leaderboard?.length) { lb.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Be the first!</div>'; return; }
    data.leaderboard.slice(0, 8).forEach((row, i) => {
      lb.appendChild(h('div', { class: 'lb-entry' },
        h('div', { class: 'lb-rank' }, '#' + (i + 1)),
        h('div', { class: 'lb-user' }, row.display_name || row.username),
        h('div', { class: 'lb-score' }, Number(row.best_score).toLocaleString())
      ));
    });
  }).catch(() => {});

  const page = h('div', { class: 'container section' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:12px;' },
      h('div', {},
        h('a', { href: '/games', 'data-link': true, style: 'color:var(--text-muted);font-size:13px;font-family:var(--font-display);letter-spacing:.1em;display:block;margin-bottom:8px;' }, '← GAMES'),
        h('h1', { style: 'font-family:var(--font-display);font-size:28px;font-weight:800;' }, game.emoji + ' ' + game.name),
        h('p', { style: 'color:var(--text-dim);font-size:14px;margin-top:4px;' }, game.description || game.short)
      ),
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' },
        h('button', { class: 'btn btn-sm', 'aria-label': 'Share game',
          onClick: () => {
            const text = 'Playing ' + game.name + ' on NEXA ARCADE! 🎮';
            if (navigator.share) navigator.share({ title: 'NEXA ARCADE', text, url: location.href });
            else { navigator.clipboard.writeText(text + ' ' + location.href); toast('Link copied!', 'success'); }
          }
        }, '🔗 Share'),
        h('button', { class: 'btn btn-sm', onClick: () => { pauseOverlay.style.display = pauseOverlay.style.display === 'flex' ? 'none' : 'flex'; } }, '⏸'),
        h('a', { href: '/games', 'data-link': true, class: 'btn btn-sm' }, '✕ Exit')
      )
    ),

    h('div', { class: 'game-wrap' },
      h('div', { class: 'game-stage', ref: (el) => stageRef.el = el, tabIndex: 0, 'aria-label': game.name + ' game area' }),
      h('div', {},
        lbPanel,
        h('div', { class: 'panel' },
          h('h3', {}, 'Controls'),
          h('div', { style: 'margin-top:4px;' },
            h('label', { class: 'v-option', style: 'margin-bottom:8px;' },
              h('input', { type: 'radio', name: 'ctrl', checked: !state.forceVirtual,
                onChange: () => { state.forceVirtual = false; route(location.pathname, false); }
              }), ' Auto-Detect'
            ),
            h('label', { class: 'v-option', style: 'margin-bottom:8px;' },
              h('input', { type: 'radio', name: 'ctrl', checked: state.forceVirtual,
                onChange: () => { state.forceVirtual = true; route(location.pathname, false); }
              }), ' Virtual D-Pad'
            ),
            h('div', { style: 'font-size:11px;color:var(--cyan);margin-top:8px;font-family:var(--font-display);letter-spacing:.1em;' },
              state.hasGamepad ? '✅ GAMEPAD LINKED' : '⌨️ KEYBOARD ACTIVE'
            )
          )
        ),
        state.user && h('div', { class: 'panel' },
          h('h3', {}, 'Your Best'),
          h('div', { id: 'my-best', style: 'font-family:var(--font-display);font-size:24px;font-weight:700;color:var(--gold);' }, '—')
        )
      )
    ),

    (state.isTouch || state.forceVirtual) && VirtualControls(),
    pauseOverlay,
    AdSlot('inContent')
  );

  if (state.user) {
    api('/api/scores/me/' + game.id).then(r => {
      const el = page.querySelector('#my-best');
      if (el) el.textContent = Number(r.best || 0).toLocaleString();
    }).catch(() => {});
  }

  queueMicrotask(() => {
    trackEvent('game_start', { game_id: game.id, game_name: game.name });
    setTimeout(() => { loader.classList.add('fade-out'); setTimeout(() => loader.remove(), 600); }, 1800);

    let heartbeatInt = setInterval(() => {
      if (!state.user) return;
      api('/api/arena/heartbeat', { method: 'POST', body: { game_id: game.id, score: state.currentScore || 0 } }).catch(() => {});
    }, 10000);

    // Stop arrow keys / space from scrolling the page while playing.
    // Self-detaches once the game stage leaves the DOM (SPA nav uses pushState,
    // so popstate alone is not reliable here).
    const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown'];
    const blockScroll = (e) => {
      if (!document.body.contains(stageRef.el)) {
        window.removeEventListener('keydown', blockScroll);
        clearInterval(heartbeatInt);
        return;
      }
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (SCROLL_KEYS.includes(e.key)) e.preventDefault();
    };
    window.addEventListener('keydown', blockScroll, { passive: false });
    window.addEventListener('popstate', () => {
      clearInterval(heartbeatInt);
      window.removeEventListener('keydown', blockScroll);
    }, { once: true });

    game.mount(stageRef.el, {
      onScore: (score) => {
        state.currentScore = score;
        if (state.user) {
          api('/api/scores', { method: 'POST', body: { game_id: game.id, score } }).then(res => {
            const el = page.querySelector('#my-best');
            if (el && score > parseInt(el.textContent.replace(/,/g, '') || '0', 10)) el.textContent = Number(score).toLocaleString();
          }).catch(() => {});
        }
        if (score > 100 && Math.random() < 0.15) {
          const loot = LootBoxModal(() => loot.remove());
          document.body.appendChild(loot);
        }
      },
      onSave: (data) => {
        if (!state.user) return;
        const sync = h('div', { class: 'sync-status' }, 'SYNCING...');
        document.body.appendChild(sync);
        api('/api/saves/' + game.id, { method: 'POST', body: { data } })
          .then(() => { sync.textContent = 'SYNCED ✓'; })
          .catch(() => { sync.textContent = 'SYNC FAILED'; })
          .finally(() => setTimeout(() => sync.remove(), 1500));
      },
      onLoad: () => {
        if (!state.user) return Promise.resolve(null);
        return api('/api/saves/' + game.id).then(r => r.save).catch(() => null);
      },
      user: state.user
    });
    stageRef.el?.focus();
  });

  return page;
}
