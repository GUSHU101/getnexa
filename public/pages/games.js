import { h, api, AdSlot, state, toast, route } from '../core.js';
import { GAMES, findGame } from '../games/index.js';
import { setAdaptiveTheme } from '../bg-3d.js';
import { playSpecificSong } from '../music-player.js';

/* ── Game categories ── */
const CATEGORIES = {
  all: { label: 'All Games', emoji: '🎮' },
  new: { label: 'New', emoji: '⭐' },
  action: { label: 'Action', emoji: '🚀', ids: ['neondrift', 'starblitz', 'fruit-slicer', 'whack-a-mole', 'emoji-catcher', 'insect-catch', 'shape-clicker', 'archery', 'slash-saber'] },
  puzzle: { label: 'Puzzle', emoji: '🧩', ids: ['2048', '2048-ext', 'tetris', 'tetris-ext', 'memory', 'memory-ext', 'minesweeper', 'minesweeper-ext', 'wordle', 'hangman', 'sudoku', 'tilting-maze', 'sliding-puzzle', 'hextris', 'tower-blocks', 'connect-four', 'number-guess', 'simon-says'] },
  arcade: { label: 'Arcade', emoji: '🕹️', ids: ['snake', 'snake-ext', 'breakout', 'breakout-ext', 'pong', 'ping-pong', 'flappy-bird', 'pacman', 'doodle-jump', 'crossy-road', 'candy-crush', 'beachy-ball'] },
  racing: { label: 'Racing', emoji: '🏎️', ids: ['overdrive', 'aviator'] },
  strategy: { label: 'Strategy', emoji: '⚔️', ids: ['chess', 'tictactoe', 'tictactoe-ext', 'solitaire', 'ancient-beast', 'rps'] },
  word: { label: 'Word & Typing', emoji: '⌨️', ids: ['wordle', 'hangman', 'speed-typing', 'typing-hero', 'typing-pro', 'quiz', 'speak-guess'] },
  multiplayer: { label: 'Multiplayer', emoji: '👥' },
  card: { label: 'Card & Board', emoji: '🃏', ids: ['solitaire', 'chess', 'dice-roll', 'rps', 'connect-four'] },
};

const GAME_COLORS = [
  ['#1a0a3a', '#0a0a2a', '#7c3aed'],
  ['#0a1a2e', '#0a0a1a', '#00e5ff'],
  ['#0a1a0a', '#0a1a10', '#10b981'],
  ['#1a1a0a', '#1a0f0a', '#f59e0b'],
  ['#2a0a0a', '#1a0a0a', '#ef4444'],
  ['#0a0a2a', '#10082a', '#a855f7'],
  ['#0a1a1a', '#0a1210', '#06b6d4'],
  ['#1a0a10', '#2a0a18', '#f0abfc'],
];

export function GameCard(game, index = 0) {
  const [c1, c2, glow] = GAME_COLORS[index % GAME_COLORS.length];
  const video = document.createElement('video');
  video.className = 'game-card-video'; video.muted = true; video.loop = true; video.playsInline = true;
  fetch('/Videos/videos.json').then(r => r.json()).then(v => {
    video.src = '/Videos/' + v[Math.floor(Math.random() * v.length)];
  }).catch(() => {});

  const badge = game.new ? h('div', { class: 'game-card-badge new' }, 'NEW')
    : game.multiplayer ? h('div', { class: 'game-card-badge mp' }, '2P')
    : null;

  const card = h('div', {
    class: 'game-card reveal-card',
    style: '--c1:' + c1 + ';--c2:' + c2 + ';--glow-color:' + glow,
    role: 'button', tabIndex: 0, 'aria-label': 'Play ' + game.name,
    onClick: () => {
      card.classList.add('spin-active');
      setTimeout(() => route('/games/' + game.id), 300);
    },
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); route('/games/' + game.id); } }
  },
    h('div', { class: 'game-card-bg' }),
    video,
    badge,
    h('div', { class: 'player-count' }, h('span', { class: 'pulse-dot' }), 'LIVE'),
    h('div', { class: 'game-card-glow' }),
    h('div', { class: 'game-card-art' }, game.emoji),
    h('div', { class: 'game-card-info' },
      h('h3', {}, game.name),
      h('p', {}, game.short)
    )
  );

  card.addEventListener('mouseenter', () => {
    video.play().catch(() => {});
    if (game.theme !== undefined) setAdaptiveTheme([0x7c5cff, 0xff5b6b, 0x24d1a1, 0xffb020, 0x00d1ff][game.theme] || 0x00f3ff);
    if (game.song) playSpecificSong(game.song);
  });
  card.addEventListener('mouseleave', () => {
    video.pause();
    setAdaptiveTheme(0x00f3ff);
  });
  return card;
}

function GlobalActivityTicker() {
  const content = h('span', { class: 'ticker-content' }, '⚡ NEXA GRID ACTIVE — MISSIONS IN PROGRESS...');
  const el = h('div', { class: 'activity-ticker' },
    h('div', { class: 'container' }, content)
  );
  const update = () => {
    api('/api/stats/real-time').then(data => {
      if (!data.activity || !data.activity.length) return;
      content.innerHTML = data.activity.map(a =>
        '⚡ <strong>' + a.username + '</strong> scored ' + Number(a.score).toLocaleString() + ' in ' + a.game_id
      ).join(' &nbsp;•&nbsp; ');
    }).catch(() => {});
  };
  setInterval(update, 30000);
  update();
  return el;
}

export function GamesPage({ query }) {
  let currentCat = query?.get('cat') || 'all';
  let searchQ = query?.get('q') || '';
  let page = 1;
  const perPage = 24;

  function getFiltered() {
    let list = GAMES;
    if (currentCat === 'new') list = list.filter(g => g.new);
    else if (currentCat === 'multiplayer') list = list.filter(g => g.multiplayer);
    else if (CATEGORIES[currentCat]?.ids) list = list.filter(g => CATEGORIES[currentCat].ids.includes(g.id));
    if (searchQ) list = list.filter(g => g.name.toLowerCase().includes(searchQ) || g.short.toLowerCase().includes(searchQ));
    return list;
  }

  const grid = h('div', { class: 'games-grid', id: 'games-grid' });
  const pag = h('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:48px;flex-wrap:wrap;', id: 'pag' });
  const countEl = h('span', { style: 'color:var(--text-muted);font-size:14px;' }, '');

  function update() {
    const filtered = getFiltered();
    const total = filtered.length;
    const totalPages = Math.ceil(total / perPage);
    if (page > totalPages) page = 1;
    const start = (page - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);

    countEl.textContent = total + ' games';
    grid.innerHTML = '';
    slice.forEach((g, i) => grid.appendChild(GameCard(g, start + i)));

    pag.innerHTML = '';
    if (totalPages > 1) {
      const addPage = (n) => pag.appendChild(h('button', {
        class: 'btn btn-sm' + (n === page ? ' btn-primary' : ''),
        onClick: () => { page = n; update(); window.scrollTo({ top: 300, behavior: 'smooth' }); }
      }, String(n)));
      if (page > 1) pag.appendChild(h('button', { class: 'btn btn-sm', onClick: () => { page--; update(); } }, '←'));
      const start2 = Math.max(1, page - 2);
      const end2 = Math.min(totalPages, start2 + 4);
      for (let i = start2; i <= end2; i++) addPage(i);
      if (page < totalPages) pag.appendChild(h('button', { class: 'btn btn-sm', onClick: () => { page++; update(); } }, '→'));
    }

    // Trigger GSAP on new cards
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      try {
        ScrollTrigger.refresh();
        gsap.utils.toArray('#games-grid .reveal-card').forEach((el, i) => {
          gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', delay: i * 0.03 });
        });
      } catch {}
    } else {
      grid.querySelectorAll('.reveal-card').forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    }
  }

  // Category pills
  const pills = h('div', { class: 'cat-pills' },
    ...Object.entries(CATEGORIES).map(([key, cat]) =>
      h('button', {
        class: 'cat-pill' + (currentCat === key ? ' active' : ''),
        onClick: (e) => {
          pills.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
          e.target.classList.add('active');
          currentCat = key; page = 1; searchQ = '';
          if (searchInput) searchInput.value = '';
          update();
        }
      }, cat.emoji + ' ' + cat.label)
    )
  );

  const searchInput = h('input', {
    type: 'search', class: 'search', placeholder: 'Search games...',
    value: searchQ,
    onInput: (e) => { searchQ = e.target.value.toLowerCase().trim(); page = 1; update(); }
  });

  update();

  return h('div', { class: 'page-games' },
    GlobalActivityTicker(),
    h('div', { class: 'container section' },
      h('div', { class: 'section-head-row' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'The Archive'),
          h('h1', { style: 'font-family:var(--font-display);font-size:clamp(28px,5vw,52px);font-weight:800;letter-spacing:-.02em;margin-bottom:8px;' }, 'All Games'),
          countEl
        ),
        h('div', { class: 'search-wrap' }, searchInput)
      ),
      pills,
      AdSlot('728x90', 'Advertisement'),
      h('div', { style: 'margin-top:32px;' }, grid),
      pag
    )
  );
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

/* ── Virtual D-Pad ── */
function VirtualControls() {
  const dispatch = (key, type) => window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  return h('div', { class: 'virtual-controls', 'aria-label': 'Game controls', role: 'group' },
    h('div', { class: 'dpad' },
      h('button', { class: 'v-btn v-up', 'aria-label': 'Up', onPointerDown: () => dispatch('ArrowUp', 'keydown'), onPointerUp: () => dispatch('ArrowUp', 'keyup') }, '▲'),
      h('button', { class: 'v-btn v-left', 'aria-label': 'Left', onPointerDown: () => dispatch('ArrowLeft', 'keydown'), onPointerUp: () => dispatch('ArrowLeft', 'keyup') }, '◀'),
      h('button', { class: 'v-btn v-right', 'aria-label': 'Right', onPointerDown: () => dispatch('ArrowRight', 'keydown'), onPointerUp: () => dispatch('ArrowRight', 'keyup') }, '▶'),
      h('button', { class: 'v-btn v-down', 'aria-label': 'Down', onPointerDown: () => dispatch('ArrowDown', 'keydown'), onPointerUp: () => dispatch('ArrowDown', 'keyup') }, '▼'),
    ),
    h('div', { class: 'action-btns' },
      h('button', { class: 'v-btn v-action', 'aria-label': 'Action', onPointerDown: () => dispatch(' ', 'keydown'), onPointerUp: () => dispatch(' ', 'keyup') }, '⚡')
    )
  );
}

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
    if (!data.leaderboard || !data.leaderboard.length) {
      lb.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Be the first!</div>';
      return;
    }
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
        h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:6px;' },
          h('a', { href: '/games', 'data-link': true, style: 'color:var(--text-muted);font-size:13px;font-family:var(--font-display);letter-spacing:.1em;' }, '← GAMES'),
        ),
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
        h('button', { class: 'btn btn-sm', 'aria-label': 'Pause',
          onClick: () => { pauseOverlay.style.display = pauseOverlay.style.display === 'flex' ? 'none' : 'flex'; }
        }, '⏸'),
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

    h('div', { style: 'margin-top:32px;' },
      AdSlot('728x90', 'Advertisement')
    )
  );

  if (state.user) {
    api('/api/scores/me/' + game.id).then(r => {
      const el = page.querySelector('#my-best');
      if (el) el.textContent = Number(r.best || 0).toLocaleString();
    }).catch(() => {});
  }

  queueMicrotask(() => {
    setTimeout(() => { loader.classList.add('fade-out'); setTimeout(() => loader.remove(), 600); }, 1800);

    let heartbeatInt = setInterval(() => {
      if (!state.user) return;
      api('/api/arena/heartbeat', { method: 'POST', body: { game_id: game.id, score: state.currentScore || 0 } }).catch(() => {});
    }, 10000);
    window.addEventListener('popstate', () => clearInterval(heartbeatInt), { once: true });

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
