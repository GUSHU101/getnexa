import { h, api, route, setSEO, AdSlot } from '../core.js';
import { GAMES } from '../games/index.js';

function LiveCounter() {
  const el = h('span', { class: 'live-count' }, '...');
  api('/api/stats/real-time').then(d => { el.textContent = Number(d.users || 0).toLocaleString(); }).catch(() => { el.textContent = '0'; });
  return el;
}

function RecentWins() {
  const scroll = h('div', { class: 'ticker-scroll' });
  const content = h('span', { class: 'ticker-content' }, 'SYNCHRONIZING LIVE DATA...');
  scroll.appendChild(content);

  const update = () => {
    api('/api/stats/real-time').then(data => {
      if (!data.activity || !data.activity.length) return;
      const parts = data.activity.map(a =>
        `<span class="win-player">${a.username}</span> scored <span class="win-score">${Number(a.score).toLocaleString()}</span> in ${a.game_id}`
      ).join('  •  ');
      content.innerHTML = parts + '  •  ' + parts;
    }).catch(() => {});
  };
  setInterval(update, 12000);
  update();
  return scroll;
}

const FEATURED_GAMES = GAMES.filter(g => g.new || ['neondrift', 'starblitz', 'chess', 'hextris', 'aviator', 'overdrive', 'slash-saber', 'candy-crush'].includes(g.id)).slice(0, 8);

const GAME_COLORS = [
  ['#1a0a3a', '#0a0a2a'],
  ['#0a1a2e', '#0a0a1a'],
  ['#1a0a1a', '#0a1a0a'],
  ['#1a1a0a', '#2a0a0a'],
  ['#0a1a1a', '#0a0a2a'],
  ['#2a0a1a', '#0a1a2a'],
];
const GLOW_COLORS = ['#7c3aed', '#00e5ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

function GameCardHome(game, index) {
  const [c1, c2] = GAME_COLORS[index % GAME_COLORS.length];
  const glow = GLOW_COLORS[index % GLOW_COLORS.length];
  const video = document.createElement('video');
  video.className = 'game-card-video'; video.muted = true; video.loop = true; video.playsInline = true;
  fetch('/Videos/videos.json').then(r => r.json()).then(v => { video.src = '/Videos/' + v[Math.floor(Math.random() * v.length)]; }).catch(() => {});

  const badge = game.new ? h('div', { class: 'game-card-badge new' }, 'NEW')
    : game.multiplayer ? h('div', { class: 'game-card-badge mp' }, 'MULTIPLAYER')
    : null;

  const card = h('div', { class: 'game-card reveal-card',
    style: '--c1:' + c1 + ';--c2:' + c2 + ';--glow-color:' + glow,
    onClick: () => { card.classList.add('spin-active'); setTimeout(() => route('/games/' + game.id), 300); },
    role: 'button', tabIndex: 0, 'aria-label': 'Play ' + game.name,
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); route('/games/' + game.id); } }
  },
    h('div', { class: 'game-card-bg' }),
    video,
    badge,
    h('div', { class: 'game-card-glow' }),
    h('div', { class: 'game-card-art' }, game.emoji),
    h('div', { class: 'game-card-info' },
      h('h3', {}, game.name),
      h('p', {}, game.short)
    )
  );
  card.addEventListener('mouseenter', () => { video.play().catch(() => {}); });
  card.addEventListener('mouseleave', () => { video.pause(); });
  return card;
}

export function HomePage() {
  setSEO({
    title: 'NEXA ARCADE — Free Browser Games',
    description: 'Play 50+ free browser games with live leaderboards, real-time multiplayer, and paid tournaments. No downloads. Instant play.',
    extra: { potentialAction: { '@type': 'PlayAction', target: 'https://getnexa.space/games' } }
  });

  const featureItems = [
    ['⚡', 'Zero-Latency Gaming'],
    ['🏆', 'Live Tournaments'],
    ['🌍', 'Global Leaderboards'],
    ['🎮', '50+ Games'],
    ['🛡️', 'Anti-Cheat Protection'],
    ['💰', 'Free to Play'],
    ['📱', 'Mobile Ready'],
    ['🔄', 'Cloud Saves'],
  ];
  const featureHTML = featureItems.map(([fi, label]) =>
    '<span class="feature-item"><span class="fi">' + fi + '</span>' + label + '</span>'
  ).join('');

  return h('div', { class: 'page-home' },

    /* ── HERO ── */
    h('section', { class: 'hero' },
      h('video', { class: 'hero-video', autoplay: true, muted: true, loop: true, playsinline: true, src: '/Videos/139010-770938030_medium.mp4', 'aria-hidden': 'true' }),
      h('div', { class: 'hero-grid-bg', 'aria-hidden': 'true' }),
      h('div', { class: 'hero-glow', 'aria-hidden': 'true' }),
      h('div', { class: 'container' },
        h('div', { class: 'hero-badge reveal-text' },
          h('span', { class: 'pulse-dot' }),
          ' LIVE — ', LiveCounter(), ' OPERATIVES ACTIVE'
        ),
        h('h1', { class: 'hero-title reveal-text' }, 'NEXA'),
        h('p', { class: 'hero-sub reveal-text' },
          '50+ free browser games. Real leaderboards. Live multiplayer. No downloads, no lag — just play.'
        ),
        h('div', { class: 'hero-btns reveal-text' },
          h('button', { onClick: () => route('/games'), class: 'btn btn-primary btn-lg' }, '🎮 Play Now — Free'),
          h('button', { onClick: () => route('/tournaments'), class: 'btn btn-lg' }, '🏆 Live Tournaments')
        ),
        h('div', { class: 'hero-stats reveal-text' },
          h('div', {},
            h('div', { class: 'stat-num' }, '50+'),
            h('div', { class: 'stat-label' }, 'Games Available')
          ),
          h('div', {},
            h('div', { class: 'stat-num' }, '100%'),
            h('div', { class: 'stat-label' }, 'Free to Play')
          ),
          h('div', {},
            h('div', { class: 'stat-num' }, '0ms'),
            h('div', { class: 'stat-label' }, 'Download Required')
          ),
          h('div', {},
            h('div', { class: 'stat-num' }, '24/7'),
            h('div', { class: 'stat-label' }, 'Live Tournaments')
          )
        )
      )
    ),

    /* ── TICKER ── */
    h('div', { class: 'live-ticker', 'aria-live': 'polite', 'aria-label': 'Recent player activity' },
      h('div', { class: 'ticker-inner container' },
        h('div', { class: 'ticker-label' }, '⚡ LIVE OPS'),
        RecentWins()
      )
    ),

    /* ── FEATURE STRIP ── */
    h('div', { class: 'feature-strip', 'aria-hidden': 'true' },
      h('div', { class: 'feature-strip-inner', html: featureHTML + featureHTML })
    ),

    /* ── FEATURED GAMES ── */
    h('section', { class: 'section' },
      h('div', { class: 'container' },
        h('div', { class: 'section-head' },
          h('div', { class: 'eyebrow' }, 'Featured'),
          h('h2', {}, 'Top Operations'),
          h('p', {}, 'The highest-rated missions on the grid right now.')
        ),
        h('div', { class: 'games-grid' },
          ...FEATURED_GAMES.map((g, i) => GameCardHome(g, i))
        ),
        h('div', { style: 'text-align:center;margin-top:48px;' },
          h('button', { onClick: () => route('/games'), class: 'btn btn-lg' }, 'Browse All 50+ Games →')
        )
      )
    ),

    /* ── AD SLOT ── */
    h('div', { class: 'container section-sm' }, AdSlot('728x90', 'Advertisement', '')),

    /* ── WHY NEXA ── */
    h('section', { class: 'section', style: 'background:rgba(255,255,255,0.015);' },
      h('div', { class: 'container' },
        h('div', { class: 'section-head text-center', style: 'text-align:center;' },
          h('div', { class: 'eyebrow' }, 'Why Choose Nexa'),
          h('h2', {}, 'Built Different'),
          h('p', { style: 'margin:0 auto;' }, 'Not another flash game site. Nexa is a professional gaming platform built on Cloudflare\'s global edge network.')
        ),
        h('div', { class: 'feature-grid' },
          h('div', { class: 'feature-card reveal-card' },
            h('span', { class: 'feature-icon' }, '⚡'),
            h('h3', {}, 'Zero-Latency Engine'),
            h('p', {}, 'Powered by Cloudflare\'s edge network with 200+ global locations. Sub-5ms input latency — your reaction time is the only bottleneck.')
          ),
          h('div', { class: 'feature-card reveal-card' },
            h('span', { class: 'feature-icon' }, '🏆'),
            h('h3', {}, 'Live Tournaments'),
            h('p', {}, 'Compete in daily and weekly tournaments with real prize pools. Enter free or stake coins for higher rewards.')
          ),
          h('div', { class: 'feature-card reveal-card' },
            h('span', { class: 'feature-icon' }, '🌍'),
            h('h3', {}, 'Global Leaderboards'),
            h('p', {}, 'Anti-cheat protected leaderboards powered by Cloudflare Turnstile. Only real scores. Only real players.')
          ),
          h('div', { class: 'feature-card reveal-card' },
            h('span', { class: 'feature-icon' }, '☁️'),
            h('h3', {}, 'Cloud Saves'),
            h('p', {}, 'Your progress follows you. Save states sync instantly across all your devices — phone, tablet, desktop.')
          ),
          h('div', { class: 'feature-card reveal-card' },
            h('span', { class: 'feature-icon' }, '🎮'),
            h('h3', {}, 'Controller Support'),
            h('p', {}, 'Plug in a gamepad and it\'s detected automatically. Touch controls on mobile. Virtual D-Pad when you need it.')
          ),
          h('div', { class: 'feature-card reveal-card' },
            h('span', { class: 'feature-icon' }, '💰'),
            h('h3', {}, 'Free to Play, Always'),
            h('p', {}, 'Every game is free. Earn coins, level up, unlock cosmetics. Premium tiers remove ads — zero pay-to-win.')
          )
        )
      )
    ),

    /* ── CATEGORIES ── */
    h('section', { class: 'section' },
      h('div', { class: 'container' },
        h('div', { class: 'section-head' },
          h('div', { class: 'eyebrow' }, 'Game Catalog'),
          h('h2', {}, 'Every Genre Covered'),
          h('p', {}, 'From lightning-fast arcade runners to deep strategy — something for every operative.')
        ),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;' },
          ...[
            { emoji: '🚀', label: 'Action & Arcade', count: '12 games', desc: 'Fast reflexes, intense action', cat: 'action' },
            { emoji: '🧩', label: 'Puzzle & Strategy', count: '14 games', desc: 'Brain-bending challenges', cat: 'puzzle' },
            { emoji: '🏎️', label: 'Racing & Speed', count: '4 games', desc: 'High-speed thrills', cat: 'racing' },
            { emoji: '🃏', label: 'Card & Board', count: '8 games', desc: 'Classic tabletop action', cat: 'card' },
            { emoji: '⌨️', label: 'Typing & Word', count: '6 games', desc: 'Test your vocabulary', cat: 'word' },
            { emoji: '⚔️', label: 'Strategy & RPG', count: '5 games', desc: 'Tactical battles', cat: 'strategy' },
          ].map(({ emoji, label, count, desc, cat }) =>
            h('div', {
              class: 'feature-card reveal-card',
              style: 'cursor:pointer;',
              onClick: () => route('/games?cat=' + cat),
              role: 'button', tabIndex: 0
            },
              h('span', { class: 'feature-icon' }, emoji),
              h('h3', {}, label),
              h('p', {}, desc),
              h('div', { style: 'color:var(--cyan);font-size:13px;font-family:var(--font-display);margin-top:12px;font-weight:700;' }, count)
            )
          )
        )
      )
    ),

    /* ── CTA ── */
    h('section', { class: 'section section-sm', style: 'background:linear-gradient(135deg,rgba(124,58,237,0.1) 0%,rgba(0,229,255,0.05) 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border);' },
      h('div', { class: 'container', style: 'text-align:center;' },
        h('div', { class: 'eyebrow reveal-text', style: 'justify-content:center;' }, 'Get Started'),
        h('h2', { class: 'reveal-text', style: 'font-family:var(--font-display);font-size:clamp(28px,5vw,52px);font-weight:800;margin-bottom:16px;' }, 'Your Profile. Your Legacy.'),
        h('p', { class: 'reveal-text', style: 'color:var(--text-dim);max-width:480px;margin:0 auto 40px;font-size:17px;line-height:1.7;' },
          'Create a free account to save scores, climb leaderboards, earn coins, and unlock exclusive cosmetics.'
        ),
        h('div', { class: 'hero-btns reveal-text', style: 'justify-content:center;' },
          h('button', { onClick: () => route('/signup'), class: 'btn btn-primary btn-lg' }, 'Create Free Account'),
          h('button', { onClick: () => route('/games'), class: 'btn btn-lg' }, 'Play Without Account')
        )
      )
    ),

    /* ── BOTTOM AD ── */
    h('div', { class: 'container section-sm' }, AdSlot('728x90', 'Advertisement', ''))
  );
}
