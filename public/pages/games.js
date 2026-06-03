import { h, api, AdSlot, state, toast, route } from '../core.js';
import { GAMES, findGame } from '../games/index.js';
import { setAdaptiveTheme } from '../bg-3d.js';
import { playSpecificSong } from '../music-player.js';

// --- Mystery Loot Box (Behavioral Loop) ---
function LootBoxModal(onClose) {
  const rewards = [
    { id: 'skin_neon', name: 'NEON GHOST SKIN', icon: '👤', rarity: 'RARE' },
    { id: 'skin_gold', name: 'GOLDEN VANGUARD', icon: '🛡️', rarity: 'EPIC' },
    { id: 'rank_boost', name: '2X RANK BOOST', icon: '⚡', rarity: 'UNCOMMON' },
    { id: 'custom_crosshair', name: 'PRECISION CORE', icon: '🎯', rarity: 'RARE' }
  ];

  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  const boxRef = { el: null };

  const el = h('div', { class: 'loot-overlay' },
    h('div', { class: 'loot-container', ref: el => boxRef.el = el },
      h('div', { class: 'loot-box-visual' }, '🎁'),
      h('h2', {}, 'NEURAL CACHE DETECTED'),
      h('p', { style: 'color: var(--text-dim); margin-bottom: 30px;' }, 'Decrypting tactical assets from the void...'),
      h('button', { class: 'btn btn-primary btn-block', onClick: (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'DECRYPTING...';
        
        // Sequence: Shake -> Flash -> Reveal
        gsap.to(boxRef.el, { x: 10, repeat: 10, duration: 0.05, yoyo: true });
        
        // Synchronize with Neural Grid (Persist to DB)
        api('/api/inventory/add', { method: 'POST', body: { item_id: reward.id, name: reward.name, rarity: reward.rarity } })
          .catch(e => console.error("Sync Error:", e));

        setTimeout(() => {
          boxRef.el.innerHTML = '';
          boxRef.el.appendChild(h('div', { class: 'reward-reveal' },
            h('div', { class: 'reward-icon' }, reward.icon),
            h('div', { class: 'reward-rarity' }, reward.rarity),
            h('h3', {}, reward.name),
            h('p', { style: 'color: var(--neon-cyan); margin-top: 10px;' }, 'ASSET SYNCHRONIZED'),
            h('button', { class: 'btn btn-block', style: 'margin-top: 20px;', onClick: onClose }, 'Accept & Close')
          ));
          gsap.from(boxRef.el.firstChild, { scale: 0.5, opacity: 0, duration: 0.5, ease: 'back.out' });
        }, 1000);
      }}, 'INITIATE DECRYPTION')
    )
  );

  return el;
}

// --- Virtual Controls System ---
function VirtualControls() {
  const dispatch = (key, type) => {
    window.dispatchEvent(new KeyboardEvent(type, { key }));
  };
  return h('div', { class: 'virtual-controls' },
    h('div', { class: 'dpad' },
      h('button', { class: 'v-btn v-up', onPointerDown: () => dispatch('ArrowUp', 'keydown'), onPointerUp: () => dispatch('ArrowUp', 'keyup') }, '▲'),
      h('button', { class: 'v-btn v-left', onPointerDown: () => dispatch('ArrowLeft', 'keydown'), onPointerUp: () => dispatch('ArrowLeft', 'keyup') }, '◀'),
      h('button', { class: 'v-btn v-right', onPointerDown: () => dispatch('ArrowRight', 'keydown'), onPointerUp: () => dispatch('ArrowRight', 'keyup') }, '▶'),
      h('button', { class: 'v-btn v-down', onPointerDown: () => dispatch('ArrowDown', 'keydown'), onPointerUp: () => dispatch('ArrowDown', 'keyup') }, '▼'),
    ),
    h('div', { class: 'action-btns' },
      h('button', { class: 'v-btn v-action', onPointerDown: () => dispatch(' ', 'keydown'), onPointerUp: () => dispatch(' ', 'keyup') }, '⚡'),
    )
  );
}

// --- Holographic Tilt Effect ---
function initTilt(el) {
  if (typeof gsap === 'undefined') return;
  el.addEventListener('mousemove', e => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(el, { rotateY: x * 15, rotateX: -y * 15, scale: 1.05, duration: 0.5, ease: 'power2.out' });
  });
  el.addEventListener('mouseleave', () => {
    gsap.to(el, { rotateY: 0, rotateX: 0, scale: 1, duration: 0.5 });
  });
}

export function GameCard(game) {
  const video = h('video', { 
    class: 'card-video', muted: true, loop: true, playsinline: true, 
    style: 'position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transition:0.8s; z-index:-1;'
  });

  fetch('/Videos/videos.json').then(r => r.json()).then(v => {
    const randomVideo = v[Math.floor(Math.random() * v.length)];
    video.src = `/Videos/${randomVideo}`;
  });

  return h('div', { 
    class: 'game-card',
    ref: initTilt,
    onMouseEnter: () => {
      video.play().then(() => video.style.opacity = '0.3');
      setAdaptiveTheme([0x7c5cff, 0xff5b6b, 0x24d1a1, 0xffb020, 0x00d1ff][game.theme || 0]);
    },
    onMouseLeave: () => { video.pause(); video.style.opacity = '0'; setAdaptiveTheme(0x00f3ff); },
    onClick: (e) => {
      e.currentTarget.classList.add('spin-active');
      setTimeout(() => route(`/games/${game.id}`), 600);
    }
  },
    video,
    h('div', { class: 'player-count' }, h('span', { class: 'pulse-dot' }), `VERIFIED`),
    h('div', { class: 'emoji', style: 'flex-grow: 1; display: flex; align-items: center; justify-content: center; font-size: 80px;' }, game.emoji),
    h('div', { class: 'card-info', style: 'padding: 30px; background: rgba(0,0,0,0.8);' },
      h('h3', { style: 'font-size: 28px; margin-bottom: 8px;' }, game.name),
      h('p', { style: 'font-size: 14px; color: var(--text-dim);' }, game.short)
    )
  );
}

function GlobalActivityTicker() {
  const el = h('div', { class: 'activity-ticker' }, h('div', { class: 'container' }, h('div', { class: 'ticker-content' }, 'SYNCHRONIZING WITH NEURAL GRID...')) );
  const update = () => {
    api('/api/stats/real-time').then(data => {
      const ticker = el.querySelector('.ticker-content');
      if (!data.activity || !data.activity.length) {
        ticker.textContent = '⚡ NEXA GRID ACTIVE • WAITING FOR NEW MISSION DATA...';
        return;
      }
      const text = data.activity.map(a => `⚡ MISSION: Operative "${a.username}" synchronized a score of ${a.score} in ${a.game_id}`).join(' • ');
      ticker.textContent = text + ' • ';
    }).catch(() => {});
  };
  setInterval(update, 30000);
  update();
  return el;
}

export function GamesPage() {
  let query = '';
  let page = 1;
  const perPage = 12;

  const container = h('div', { class: 'page-games' },
    GlobalActivityTicker(),
    h('div', { class: 'container section' },
      h('div', { class: 'trending-hero reveal-text' },
        h('video', { class: 'trending-video', autoplay: true, muted: true, loop: true, src: '/Videos/139010-770938030_medium.mp4' }),
        h('div', { class: 'trending-content' },
          h('div', { class: 'section-eyebrow', style: 'color: var(--neon-gold);' }, 'TRENDING OPERATION'),
          h('h1', { style: 'font-size: 80px;' }, 'Doodle Jump: The Glitch'),
          h('button', { class: 'btn btn-primary', onClick: () => route('/games/doodle-jump') }, 'Step into the Grid')
        )
      ),
      h('div', { style: 'display:flex; justify-content: space-between; align-items: flex-end; margin-bottom: 60px;' },
        h('div', {}, h('h2', { style: 'font-size: 60px;' }, 'THE ARCHIVE'), h('p', { color: 'var(--text-dim)' }, 'Explore the verified collection of Nexa legends.')),
        h('input', { placeholder: 'Search...', class: 'search', onInput: (e) => { query = e.target.value.toLowerCase(); page = 1; update(); } })
      ),
      h('div', { id: 'games-grid', class: 'grid' }),
      h('div', { id: 'pagination', style: 'margin-top: 60px; display: flex; gap: 10px; justify-content: center;' })
    )
  );

  function update() {
    const grid = container.querySelector('#games-grid');
    const pag = container.querySelector('#pagination');
    const filtered = GAMES.filter(g => !query || g.name.toLowerCase().includes(query) || g.short.toLowerCase().includes(query));
    
    // Grid Render
    const start = (page - 1) * perPage;
    grid.innerHTML = '';
    filtered.slice(start, start + perPage).forEach(g => grid.appendChild(GameCard(g)));
    
    // Pagination Render
    pag.innerHTML = '';
    const totalPages = Math.ceil(filtered.length / perPage);
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        pag.appendChild(h('button', { 
          class: `btn btn-sm ${i === page ? 'btn-primary' : ''}`, 
          onClick: () => { page = i; update(); window.scrollTo(0, 500); }
        }, i));
      }
    }
  }
  update();
  return container;
}

export function GamePage({ params }) {
  const game = findGame(params.id);
  if (!game) return h('div', {}, '404');

  const stageRef = { el: null };
  const vControlsRef = { el: null };

  const loader = h('div', { class: 'game-loader-overlay' },
    h('div', { class: 'loader-name' }, state.user?.username || 'ANONYMOUS'),
    h('div', { class: 'loader-ready' }, 'SYNCHRONIZING CONTROLS...')
  );
  document.body.appendChild(loader);

  const page = h('div', { class: 'container section' },
    h('div', { style: 'display:flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px;' },
      h('div', {}, h('h1', { style: 'font-size: 48px;' }, `${game.emoji} ${game.name}`)),
      h('div', { style: 'display:flex; gap: 10px;' },
        h('button', { class: 'btn', onClick: () => {
          const text = `I just synchronized with the ${game.name} grid on NEXA ARCADE! Can you beat my high score? 🚀🕹️`;
          const url = window.location.href;
          if (navigator.share) {
            navigator.share({ title: 'NEXA ARCADE', text, url });
          } else {
            navigator.clipboard.writeText(`${text} ${url}`);
            toast('Share Link Copied to Clipboard', 'success');
          }
        } }, '🔗 Share'),
        h('button', { class: 'btn', onClick: () => { const m = page.querySelector('.pause-overlay'); m.style.display = m.style.display === 'grid' ? 'none' : 'grid'; } }, '⏸️'),
        h('a', { href: '/games', 'data-link': true, class: 'btn' }, 'Exit')
      )
    ),
    h('div', { class: 'game-wrap' },
      h('div', { class: 'game-stage', ref: (el) => stageRef.el = el, tabIndex: 0 }),
      h('div', { class: 'game-side' },
        h('div', { class: 'panel' },
          h('h3', {}, 'Controller Link'),
          h('div', { style: 'margin-top: 15px;' },
            h('label', { class: 'v-option', style: 'display:block; margin-bottom: 10px;' }, 
              h('input', { type: 'radio', name: 'ctrl', checked: !state.forceVirtual, onChange: () => { state.forceVirtual = false; route(location.pathname, false); } }), ' Auto-Detect'
            ),
            h('label', { class: 'v-option', style: 'display:block; margin-bottom: 10px;' }, 
              h('input', { type: 'radio', name: 'ctrl', checked: state.forceVirtual, onChange: () => { state.forceVirtual = true; route(location.pathname, false); } }), ' Virtual D-Pad (Manual)'
            ),
            h('div', { style: 'font-size: 12px; color: var(--neon-cyan); margin-top: 10px;' }, 
              state.hasGamepad ? '✅ Gamepad Connected' : '⌨️ Keyboard/Mouse Active'
            )
          )
        )
      )
    ),
    (state.isTouch || state.forceVirtual) && VirtualControls(),
    h('div', { class: 'pause-overlay', style: 'display:none;' },
      h('div', { class: 'pause-menu' },
        h('h2', {}, 'PAUSED'),
        h('button', { class: 'btn btn-primary btn-block', onClick: () => { page.querySelector('.pause-overlay').style.display = 'none'; stageRef.el.focus(); } }, 'Resume'),
        h('button', { class: 'btn btn-block', onClick: () => route('/games') }, 'Quit')
      )
    )
  );

  queueMicrotask(() => {
    setTimeout(() => { loader.classList.add('fade-out'); setTimeout(() => loader.remove(), 500); }, 2000);
    let heartbeatInt = setInterval(() => {
      if (!state.user) return;
      // Get current score if the game provides a way, or just ping presence
      // For now, we'll just ping that we are playing. 
      // If we had a way to pull 'currentScore' from the game instance, we'd use it.
      api('/api/arena/heartbeat', { method: 'POST', body: { game_id: game.id, score: state.currentScore || 0 } }).catch(() => {});
    }, 10000);

    game.mount(stageRef.el, { 
      onScore: (score) => {
        state.currentScore = score;
        // Dopamine Loop: 20% chance of Loot Box on any score event > 100
        if (score > 100 && Math.random() < 0.2) {
          const loot = LootBoxModal(() => loot.remove());
          document.body.appendChild(loot);
        }
      },
      onSave: (data) => {
        if (!state.user) return;
        const sync = h('div', { class: 'sync-status' }, 'DEEP-SYNCING...');
        document.body.appendChild(sync);
        api(`/api/saves/${game.id}`, { method: 'POST', body: { data } })
          .then(() => { sync.textContent = 'SYNC SUCCESS'; setTimeout(() => sync.remove(), 1000); })
          .catch(() => { sync.textContent = 'SYNC ERROR'; setTimeout(() => sync.remove(), 1000); });
      },
      onLoad: () => {
        if (!state.user) return Promise.resolve(null);
        return api(`/api/saves/${game.id}`).then(res => res.data).catch(() => null);
      },
      user: state.user 
    });
    stageRef.el.focus();

    // Patch: Ensure heartbeat stops
    const originalRoute = window.route;
    window.addEventListener('popstate', () => clearInterval(heartbeatInt), { once: true });
  });

  return page;
}
