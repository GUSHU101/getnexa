import { h, api, toast, state, route, AdSlot } from '../core.js';
import { findGame } from '../games/index.js';

function NeuralBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const nodes = Array.from({ length: 50 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
  }));
  let mouse = { x: -1000, y: -1000 };
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0,229,255,0.1)'; ctx.lineWidth = 1;
    nodes.forEach((n, i) => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
      if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      nodes.slice(i + 1).forEach(m => {
        const d = Math.hypot(n.x - m.x, n.y - m.y);
        if (d < 150) { ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke(); }
      });
      if (Math.hypot(n.x - mouse.x, n.y - mouse.y) < 100) {
        ctx.fillStyle = 'rgba(0,229,255,0.5)';
        ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI * 2); ctx.fill();
      }
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  draw();
}

function MagneticButton(el) {
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${x * 0.3}px,${y * 0.3}px) scale(1.1)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
}

// ── Age Verification Modal ───────────────────────────────────────────────────
function AgeGateModal(onConfirm, onCancel) {
  const modal = h('div', { class: 'age-gate-overlay' },
    h('div', { class: 'age-gate-modal panel' },
      h('div', { class: 'age-gate-icon' }, '🔞'),
      h('h2', { style: 'margin-bottom:8px;' }, 'Age Verification Required'),
      h('p', { style: 'color:var(--text-dim); margin-bottom:8px; font-size:14px;' },
        'Cash prize tournaments are open to players aged 18 and older. This is a skill-based competition under applicable law.'
      ),
      h('div', { class: 'legal-notice-box', style: 'margin-bottom:20px;' },
        h('strong', {}, '⚖️ Legal Notice: '),
        'These are skill-based competitions. Prizes are awarded based on score and performance, not chance. Players must be 18+ and located in a jurisdiction where skill-based prize competitions are permitted. Georgia residents: see our ',
        h('a', { href: '/terms', 'data-link': true, style: 'color:var(--cyan);' }, 'Terms of Service'),
        ' for compliance details.'
      ),
      h('label', { style: 'display:block; margin-bottom:8px; font-size:13px; color:var(--text-dim);' }, 'Date of Birth'),
      h('input', {
        type: 'date', id: 'age-gate-dob', class: 'form-input',
        max: new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        style: 'width:100%; margin-bottom:16px;'
      }),
      h('div', { style: 'display:flex; gap:10px;' },
        h('button', {
          class: 'btn btn-primary', style: 'flex:1;',
          onClick: async () => {
            const dob = modal.querySelector('#age-gate-dob').value;
            if (!dob) { toast('Please enter your date of birth', 'error'); return; }
            try {
              const res = await api('/api/auth/verify-age', { method: 'POST', body: { date_of_birth: dob } });
              if (res.age_verified) {
                if (state.user) state.user.age_verified = 1;
                modal.remove();
                onConfirm();
              } else {
                toast('You must be 18 or older to enter cash tournaments.', 'error');
              }
            } catch (e) { toast(e.message || 'Verification failed', 'error'); }
          }
        }, 'Verify My Age'),
        h('button', { class: 'btn', style: 'flex:1;', onClick: () => { modal.remove(); if (onCancel) onCancel(); } }, 'Cancel')
      ),
      h('p', { style: 'font-size:11px; color:var(--text-muted); text-align:center; margin-top:14px;' },
        'By verifying, you confirm you are 18+ and agree to our tournament Terms of Service. Age data is stored securely and never sold.'
      )
    )
  );
  document.body.appendChild(modal);
}

// ── Georgia Legal Compliance Banner ─────────────────────────────────────────
function LegalComplianceBanner() {
  return h('div', { class: 'legal-banner' },
    h('div', { class: 'container' },
      h('div', { class: 'legal-banner-inner' },
        h('span', { class: 'legal-banner-icon' }, '⚖️'),
        h('div', { class: 'legal-banner-text' },
          h('strong', {}, 'Skill-Based Competitions — '),
          'All NEXA Arcade tournaments are skill-based prize competitions. Outcomes are determined entirely by player performance score, not chance. Players compete on a level field under fair rules. ',
          h('strong', {}, 'Georgia Residents: '),
          'Skill-based gaming competitions are permitted under O.C.G.A. § 16-12-20 where skill predominates. Cash tournaments require age 18+. A free-entry alternative is always available. ',
          h('a', { href: '/terms', 'data-link': true, style: 'color:var(--cyan);' }, 'Full Legal Terms →')
        )
      )
    )
  );
}

// ── Free Entry Option (Sweepstakes Compliance) ───────────────────────────────
function FreeEntryNotice(t) {
  if (t.entry_cents === 0) return null;
  return h('div', { class: 'free-entry-notice' },
    h('span', { class: 'free-entry-icon' }, '🎟️'),
    h('span', {},
      h('strong', {}, 'Free Entry Available: '),
      'No purchase necessary. Free-tier players may enter by playing the tournament game and submitting a qualifying score within the tournament window. ',
      h('a', { href: '/games/' + t.game_id, 'data-link': true, style: 'color:var(--cyan);' }, 'Play Now for Free →')
    )
  );
}

// ── Tournament Stats Bar ─────────────────────────────────────────────────────
function TournamentStatsBar(t, entries) {
  const prizeStr = t.prize_pool_cents > 0
    ? (t.prize_pool_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : 'Free';
  const entryStr = t.entry_cents > 0
    ? (t.entry_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : 'Free';
  return h('div', { class: 'tourn-stats-bar' },
    h('div', { class: 'tourn-stat' }, h('div', { class: 'tourn-stat-val' }, prizeStr), h('div', { class: 'tourn-stat-label' }, 'Prize Pool')),
    h('div', { class: 'tourn-stat' }, h('div', { class: 'tourn-stat-val' }, entryStr), h('div', { class: 'tourn-stat-label' }, 'Entry Fee')),
    h('div', { class: 'tourn-stat' }, h('div', { class: 'tourn-stat-val' }, String(entries ?? 0)), h('div', { class: 'tourn-stat-label' }, 'Players')),
    h('div', { class: 'tourn-stat' }, h('div', { class: 'tourn-stat-val' }, t.prize_pool_cents > 0 ? '18+' : 'All Ages'), h('div', { class: 'tourn-stat-label' }, 'Age Req.')),
  );
}

// ── Prize Distribution Display ───────────────────────────────────────────────
function PrizeBreakdown(prize_pool_cents) {
  if (!prize_pool_cents) return null;
  const pool = prize_pool_cents / 100;
  const places = [
    { place: '🥇 1st Place', pct: 50 },
    { place: '🥈 2nd Place', pct: 30 },
    { place: '🥉 3rd Place', pct: 15 },
    { place: '4th–10th Place', pct: 5 },
  ];
  return h('div', { class: 'prize-breakdown panel', style: 'margin-top: 24px;' },
    h('h4', { style: 'margin-bottom:14px; color:var(--gold);' }, '💰 Prize Distribution'),
    h('div', { class: 'prize-breakdown-grid' },
      ...places.map(p => h('div', { class: 'prize-row' },
        h('span', { class: 'prize-place' }, p.place),
        h('span', { class: 'prize-amount' }, '$' + (pool * p.pct / 100).toFixed(2)),
        h('span', { class: 'prize-pct', style: 'color:var(--text-muted);font-size:11px;' }, '(' + p.pct + '%)')
      ))
    )
  );
}

export function TournamentsPage() {
  const canvas = h('canvas', { style: 'position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0.3;' });

  const wrap = h('div', {},
    LegalComplianceBanner(),
    h('div', { class: 'container section' },
      canvas,
      h('div', { style: 'display:flex; justify-content:space-between; flex-wrap:wrap; gap:20px; align-items:flex-start; margin-bottom:40px;' },
        h('div', { class: 'section-head' },
          h('div', { class: 'section-eyebrow' }, 'NEURAL GRID ACTIVE'),
          h('h1', {}, 'Competitive Operations'),
          h('p', { style: 'max-width:680px;color:var(--text-dim);' },
            'Skill-based prize competitions open to all players. High scores win. Pure performance — no luck, no pay-to-win. ',
            h('span', { style: 'color:var(--cyan);' }, 'Cash tournaments require 18+ age verification.')
          )
        ),
        h('div', { class: 'hof-widget reveal-text panel' },
          h('h4', { style: 'margin-bottom:15px;font-size:14px;color:var(--gold);' }, '🏆 DEFENDING CHAMPIONS'),
          h('div', { style: 'display:flex;gap:10px;' },
            ...[['Felix','🥇'],['Nala','🥈'],['Milo','🥉']].map(([seed, medal]) =>
              h('div', { style: 'text-align:center;' },
                h('div', { class: 'hof-avatar', style: `background:url(https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}) center/cover;` }),
                h('div', { style: 'font-size:11px;margin-top:4px;' }, medal)
              )
            )
          )
        )
      ),
      h('div', { id: 'tournament-list', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px;' },
        h('div', { class: 'panel' }, 'INITIALIZING NEURAL GRID…')
      ),
      AdSlot('inContent')
    )
  );

  queueMicrotask(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    NeuralBackground(canvas);
  });

  api('/api/tournaments').then(({ tournaments, now }) => {
    const list = wrap.querySelector('#tournament-list');
    list.innerHTML = '';
    if (!tournaments.length) {
      list.appendChild(h('div', { class: 'panel', style: 'grid-column:1/-1;text-align:center;padding:48px;' },
        h('div', { style: 'font-size:48px;margin-bottom:16px;' }, '🏆'),
        h('h3', { style: 'margin-bottom:8px;' }, 'No Active Tournaments'),
        h('p', { style: 'color:var(--text-dim);' }, 'New tournaments are scheduled weekly. Check back soon — or play now to warm up on the leaderboards.'),
        h('a', { href: '/games', 'data-link': true, class: 'btn btn-primary', style: 'margin-top:20px;' }, 'Play Games Now')
      ));
      return;
    }
    tournaments.forEach((t, i) => {
      const card = TournamentCard(t, now);
      card.style.animationDelay = i * 80 + 'ms';
      card.classList.add('stagger-in');
      list.appendChild(card);
    });
  }).catch(e => {
    wrap.querySelector('#tournament-list').innerHTML = '<div class="panel">Error loading tournaments: ' + e.message + '</div>';
  });

  return wrap;
}

export function TournamentCard(t, now) {
  const game = findGame(t.game_id);
  const endsInMs = Math.max(0, t.ends_at - now);
  const totalDuration = 7 * 24 * 60 * 60 * 1000;
  const progress = Math.min(100, (1 - endsInMs / totalDuration) * 100);
  const days = Math.floor(endsInMs / 86400000);
  const hours = Math.floor((endsInMs % 86400000) / 3600000);
  const isCashTournament = t.prize_pool_cents > 0;

  const video = h('video', { muted: true, loop: true, playsinline: true, style: 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:0.8s;z-index:-1;' });
  fetch('/Videos/videos.json').then(r => r.json()).then(v => { video.src = '/Videos/' + v[Math.floor(Math.random() * v.length)]; }).catch(() => {});

  const joinBtn = h('button', { class: 'btn btn-primary magnetic', style: 'width:100%;' },
    isCashTournament ? '💰 Enter Cash Tournament' : '⚡ Join Free Tournament'
  );
  MagneticButton(joinBtn);

  const prize = isCashTournament
    ? (t.prize_pool_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : 'FREE';

  const card = h('div', {
    class: 'tournament-card',
    onMouseEnter: () => video.play().then(() => video.style.opacity = '0.25'),
    onMouseLeave: () => { video.pause(); video.style.opacity = '0'; }
  },
    video,
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' },
      h('div', { class: 'badge', style: 'background:rgba(0,229,255,0.1);color:var(--cyan);' }, (game?.emoji || '🎮') + ' ' + (game?.name || t.game_id)),
      isCashTournament
        ? h('div', { class: 'badge', style: 'background:rgba(245,158,11,0.15);color:var(--gold);border-color:rgba(245,158,11,0.3);' }, '💰 CASH PRIZE')
        : h('div', { class: 'badge', style: 'background:rgba(16,185,129,0.1);color:var(--green);border-color:rgba(16,185,129,0.3);' }, '🆓 FREE TO ENTER')
    ),
    h('h3', { style: 'margin:0 0 8px;' }, t.title),
    h('p', { style: 'font-size:13px;color:var(--text-dim);margin-bottom:20px;' }, t.description || 'Compete for the highest score in the tournament window. Skill wins.'),

    TournamentStatsBar(t, t.entries),
    isCashTournament ? PrizeBreakdown(t.prize_pool_cents) : null,
    FreeEntryNotice(t),

    h('div', { style: 'margin:20px 0 16px;' },
      h('div', { style: 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;' },
        h('span', { style: 'color:var(--text-dim);' }, 'Time Remaining'),
        h('span', { style: days < 1 ? 'color:var(--red);' : '' }, days + 'd ' + hours + 'h')
      ),
      h('div', { class: 'progress-container' },
        h('div', { class: 'progress-bar' + (days < 1 ? ' progress-pulse' : ''), style: 'width:' + progress + '%;' })
      )
    ),

    h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;' },
      joinBtn,
      h('a', { href: '/games/' + t.game_id, 'data-link': true, class: 'btn', style: 'text-align:center;' }, '▶ Play Game')
    ),

    isCashTournament ? h('p', { style: 'font-size:10px;color:var(--text-muted);text-align:center;margin-top:10px;' },
      '18+ only • Skill-based competition • See terms for eligibility • Free entry available'
    ) : null
  );

  joinBtn.onclick = async () => {
    if (!state.user) { toast('Log in to enter tournaments', ''); route('/login'); return; }

    if (isCashTournament && !state.user.age_verified) {
      AgeGateModal(
        () => joinBtn.onclick(),
        null
      );
      return;
    }

    try {
      const res = await api('/api/tournaments/' + t.id + '/join', { method: 'POST' });
      if (res.already) { toast('Already entered this tournament!', 'success'); return; }
      if (res.ok) {
        toast(isCashTournament ? '💰 Entered! Play to submit your score.' : '⚡ Joined! Good luck!', 'success');
        joinBtn.textContent = '✅ Entered';
        joinBtn.disabled = true;
      } else if (res.need_payment) {
        toast('Not enough coins. Buy entry in the Shop.', 'error');
        route('/shop');
      }
    } catch (e) {
      if (e.message?.includes('age_required') || e.message?.includes('underage')) {
        toast('You must be 18+ to enter cash tournaments.', 'error');
        if (!state.user.age_verified) AgeGateModal(() => {}, null);
      } else {
        toast(e.message || 'Entry failed', 'error');
      }
    }
  };

  return card;
}
