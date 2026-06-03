import { h, api, toast, state, route } from '../core.js';

const AVATAR_PRESETS = [
  '🕹️', '👾', '🚀', '🔥', '💎', '👑', '🦸', '🥷', '🐲', '🦄', '⚡', '🌈', '💀', '🤖', '🎮', '🏆',
];

/* ── Login Page ── */
export function LoginPage() {
  let loading = false;

  const errEl = h('div', { style: 'display:none;color:var(--red);background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:var(--radius);padding:12px 16px;font-size:14px;margin-bottom:16px;font-family:var(--font-ui);' });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    loading = true;
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = 'Signing in...';
    btn.disabled = true;
    errEl.style.display = 'none';

    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: {
          identifier: form.identifier.value.trim(),
          password: form.password.value,
        },
      });
      state.user = res.user;
      toast('Welcome back, ' + res.user.username + '!', 'success');
      route('/account');
    } catch (err) {
      errEl.textContent = err.message || 'Login failed. Check your credentials.';
      errEl.style.display = 'block';
      btn.textContent = origText;
      btn.disabled = false;
    } finally {
      loading = false;
    }
  };

  return h('div', { class: 'auth-page' },
    h('div', { class: 'auth-card' },
      h('div', { style: 'text-align:center;margin-bottom:32px;' },
        h('div', { style: 'font-family:var(--font-display);font-size:32px;font-weight:900;background:linear-gradient(135deg,#fff,var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px;' }, 'NEXA'),
        h('h1', { class: 'auth-title' }, 'Sign In'),
        h('p', { class: 'auth-sub' }, 'Welcome back, operative.')
      ),
      errEl,
      h('form', { onSubmit },
        h('div', { class: 'form-group' },
          h('label', {}, 'Username or Email'),
          h('input', {
            class: 'form-input', name: 'identifier', type: 'text',
            required: true, autocomplete: 'username',
            placeholder: 'your_username or email@example.com'
          })
        ),
        h('div', { class: 'form-group' },
          h('label', {}, 'Password'),
          h('input', {
            class: 'form-input', name: 'password', type: 'password',
            required: true, autocomplete: 'current-password',
            placeholder: '••••••••', minLength: 8
          })
        ),
        h('button', { class: 'btn btn-primary btn-block', type: 'submit', style: 'margin-top:8px;' }, 'Sign In'),
        h('p', { class: 'form-note' },
          "Don't have an account? ",
          h('a', { href: '/signup', 'data-link': true }, 'Create one free')
        )
      )
    )
  );
}

/* ── Signup Page ── */
export function SignupPage() {
  let loading = false;

  const errEl = h('div', { style: 'display:none;color:var(--red);background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:var(--radius);padding:12px 16px;font-size:14px;margin-bottom:16px;font-family:var(--font-ui);' });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const form = e.target;
    errEl.style.display = 'none';

    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const password2 = form.password2.value;

    if (password !== password2) {
      errEl.textContent = 'Passwords do not match.';
      errEl.style.display = 'block';
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username.toLowerCase())) {
      errEl.textContent = 'Username: 3–20 characters, letters/numbers/underscore only.';
      errEl.style.display = 'block';
      return;
    }

    loading = true;
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = 'Creating account...';
    btn.disabled = true;

    try {
      const res = await api('/api/auth/signup', {
        method: 'POST',
        body: { username, email, password },
      });
      state.user = res.user;
      toast('Account created! Welcome, ' + res.user.username + '!', 'success');
      route('/games');
    } catch (err) {
      errEl.textContent = err.message || 'Signup failed. Try a different username or email.';
      errEl.style.display = 'block';
      btn.textContent = origText;
      btn.disabled = false;
    } finally {
      loading = false;
    }
  };

  return h('div', { class: 'auth-page' },
    h('div', { class: 'auth-card' },
      h('div', { style: 'text-align:center;margin-bottom:32px;' },
        h('div', { style: 'font-family:var(--font-display);font-size:32px;font-weight:900;background:linear-gradient(135deg,#fff,var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px;' }, 'NEXA'),
        h('h1', { class: 'auth-title' }, 'Create Account'),
        h('p', { class: 'auth-sub' }, 'Free forever. No credit card needed.')
      ),
      errEl,
      h('form', { onSubmit },
        h('div', { class: 'form-group' },
          h('label', {}, 'Username'),
          h('input', {
            class: 'form-input', name: 'username', type: 'text',
            required: true, autocomplete: 'username',
            placeholder: 'your_handle', minLength: 3, maxLength: 20,
            pattern: '^[a-zA-Z0-9_]{3,20}$',
            title: '3–20 characters, letters, numbers, or underscores'
          })
        ),
        h('div', { class: 'form-group' },
          h('label', {}, 'Email Address'),
          h('input', {
            class: 'form-input', name: 'email', type: 'email',
            required: true, autocomplete: 'email',
            placeholder: 'you@example.com'
          })
        ),
        h('div', { class: 'form-group' },
          h('label', {}, 'Password'),
          h('input', {
            class: 'form-input', name: 'password', type: 'password',
            required: true, autocomplete: 'new-password',
            placeholder: 'Minimum 8 characters', minLength: 8
          })
        ),
        h('div', { class: 'form-group' },
          h('label', {}, 'Confirm Password'),
          h('input', {
            class: 'form-input', name: 'password2', type: 'password',
            required: true, autocomplete: 'new-password',
            placeholder: 'Repeat password', minLength: 8
          })
        ),
        h('div', { style: 'font-size:12px;color:var(--text-muted);margin-bottom:20px;line-height:1.6;' },
          'By creating an account you agree to our ',
          h('a', { href: '/terms', 'data-link': true, style: 'color:var(--cyan);' }, 'Terms of Service'),
          ' and ',
          h('a', { href: '/privacy', 'data-link': true, style: 'color:var(--cyan);' }, 'Privacy Policy'),
          '.'
        ),
        h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Create Free Account'),
        h('p', { class: 'form-note' },
          'Already have an account? ',
          h('a', { href: '/login', 'data-link': true }, 'Sign in')
        )
      )
    )
  );
}

/* ── Account / Profile Page ── */
export function AccountPage() {
  if (!state.user) { route('/login'); return h('div'); }
  const user = state.user;

  const onLogout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    state.user = null;
    toast('Signed out.', 'success');
    route('/');
  };

  const onSave = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const avatar = form.selected_avatar.value || form.avatar_url.value || user.avatar || '';
      await api('/api/profile', {
        method: 'PATCH',
        body: { display_name: form.display.value.trim(), avatar }
      });
      state.user = { ...state.user, display_name: form.display.value.trim(), avatar };
      toast('Profile saved!', 'success');
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  };

  const xpForNextLevel = (level) => level * level * 100;
  const xpProgress = Math.min(100, Math.round((user.xp / xpForNextLevel(user.level + 1)) * 100));

  const statsEl = h('div', { class: 'stat-chips' },
    h('div', { class: 'stat-chip' }, h('div', { class: 'stat-chip-val' }, String(user.level)), h('div', { class: 'stat-chip-label' }, 'Level')),
    h('div', { class: 'stat-chip' }, h('div', { class: 'stat-chip-val' }, Number(user.xp).toLocaleString()), h('div', { class: 'stat-chip-label' }, 'XP')),
    h('div', { class: 'stat-chip' }, h('div', { class: 'stat-chip-val' }, Number(user.coins).toLocaleString()), h('div', { class: 'stat-chip-label' }, 'Coins')),
  );

  const avatarPreviewEl = h('div', { style: 'font-size:40px;' }, user.avatar && !user.avatar.startsWith('http') ? user.avatar : '👤');
  const avatarWrap = h('div', { class: 'avatar', style: 'width:80px;height:80px;font-size:36px;flex-shrink:0;', 'aria-label': 'Avatar' }, avatarPreviewEl);

  const selectedAvatarInput = h('input', { type: 'hidden', name: 'selected_avatar', value: user.avatar && !user.avatar.startsWith('http') ? user.avatar : '' });

  const avatarPills = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;' },
    ...AVATAR_PRESETS.map(p =>
      h('button', {
        type: 'button',
        style: 'width:44px;height:44px;border-radius:10px;border:1px solid var(--border);background:var(--bg-elevated);cursor:pointer;font-size:20px;transition:all .2s;' + (user.avatar === p ? 'border-color:var(--cyan);background:var(--cyan-dim);' : ''),
        'aria-label': 'Select avatar ' + p,
        onClick: (e) => {
          avatarPills.querySelectorAll('button').forEach(b => b.style.borderColor = 'var(--border)');
          e.currentTarget.style.borderColor = 'var(--cyan)';
          e.currentTarget.style.background = 'var(--cyan-dim)';
          selectedAvatarInput.value = p;
          avatarPreviewEl.textContent = p;
        }
      }, p)
    )
  );

  const lbEl = h('div', { style: 'display:flex;flex-direction:column;gap:4px;' },
    h('div', { style: 'color:var(--text-muted);font-size:13px;' }, 'Loading your scores...')
  );

  const wrap = h('div', { class: 'container section', style: 'padding-top:120px;' },

    /* ── Profile Header ── */
    h('div', { class: 'profile-header' },
      avatarWrap,
      h('div', { style: 'flex:1;min-width:0;' },
        h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;' },
          h('h1', { style: 'font-family:var(--font-display);font-size:22px;font-weight:800;' }, user.display_name || user.username),
          h('span', { class: 'tier-badge tier-' + (user.tier || 'free') }, (user.tier || 'free').toUpperCase())
        ),
        h('div', { style: 'font-size:14px;color:var(--text-dim);margin-bottom:10px;' }, '@' + user.username + ' · ' + user.email),
        statsEl,
        h('div', { style: 'margin-top:14px;' },
          h('div', { style: 'font-size:11px;color:var(--text-muted);font-family:var(--font-display);letter-spacing:.1em;margin-bottom:4px;' },
            'XP TO LEVEL ' + (user.level + 1) + ' — ' + xpProgress + '%'
          ),
          h('div', { class: 'xp-bar' }, h('div', { class: 'xp-fill', style: 'width:' + xpProgress + '%;' }))
        )
      ),
      h('button', { class: 'btn btn-sm', onClick: onLogout, style: 'align-self:flex-start;flex-shrink:0;' }, 'Sign Out')
    ),

    /* ── Two-column grid ── */
    h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:20px;', class: 'account-cols' },

      /* Edit Profile */
      h('div', { class: 'panel' },
        h('h3', {}, 'Edit Profile'),
        h('form', { onSubmit: onSave, style: 'margin-top:16px;' },
          h('div', { class: 'form-group' },
            h('label', {}, 'Display Name'),
            h('input', {
              class: 'form-input', name: 'display', type: 'text',
              value: user.display_name || user.username, maxLength: 40
            })
          ),
          h('div', { class: 'form-group' },
            h('label', {}, 'Avatar Emoji'),
            avatarPills,
            selectedAvatarInput
          ),
          h('div', { class: 'form-group' },
            h('label', {}, 'Or Avatar Image URL'),
            h('input', {
              class: 'form-input', name: 'avatar_url', type: 'url',
              placeholder: 'https://...', maxLength: 200,
              value: user.avatar && user.avatar.startsWith('http') ? user.avatar : '',
              onInput: (e) => {
                const v = e.target.value.trim();
                if (v.startsWith('http')) {
                  avatarPreviewEl.innerHTML = '';
                  const img = document.createElement('img');
                  img.src = v; img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; img.style.borderRadius = '50%';
                  avatarPreviewEl.appendChild(img);
                }
              }
            })
          ),
          h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Save Changes')
        )
      ),

      /* Stats & Scores */
      h('div', { style: 'display:flex;flex-direction:column;gap:16px;' },
        h('div', { class: 'panel' },
          h('h3', {}, 'Your Scores'),
          lbEl
        ),
        h('div', { class: 'panel' },
          h('h3', {}, 'Upgrade Tier'),
          h('p', { style: 'font-size:13px;color:var(--text-dim);margin:8px 0 16px;line-height:1.6;' },
            'Go ad-free and unlock exclusive features with an Operative subscription.'
          ),
          h('a', { href: '/shop', 'data-link': true, class: 'btn btn-primary btn-block' }, '🏆 View Plans')
        ),
        user.tier === 'free' && h('div', { class: 'panel' },
          h('h3', {}, 'Daily Bonus'),
          h('p', { style: 'font-size:13px;color:var(--text-dim);margin:8px 0 16px;' }, 'Log in daily to earn free coins.'),
          h('button', { class: 'btn btn-block', onClick: async (e) => {
            e.target.disabled = true;
            try {
              const r = await api('/api/daily-pulse', { method: 'POST' });
              if (r.ok) {
                toast('+' + r.reward + ' coins claimed!', 'success');
                e.target.textContent = 'Come back tomorrow';
              }
            } catch (err) {
              const msg = err.message || '';
              if (msg.includes('already')) {
                toast('Already claimed today!', 'error');
                e.target.textContent = 'Come back tomorrow';
              } else {
                e.target.disabled = false;
                toast(msg || 'Error', 'error');
              }
            }
          }}, '🎁 Claim Daily Coins')
        )
      )
    )
  );

  /* Load scores after mount */
  queueMicrotask(() => {
    api('/api/profile/' + user.username).then(data => {
      lbEl.innerHTML = '';
      if (!data.scores || !data.scores.length) {
        lbEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No scores yet — go play something!</div>';
        return;
      }
      const sorted = [...data.scores].sort((a, b) => b.best - a.best).slice(0, 8);
      sorted.forEach(s => {
        lbEl.appendChild(h('div', { class: 'lb-entry' },
          h('div', { class: 'lb-user' }, s.game_id),
          h('div', { class: 'lb-score' }, Number(s.best).toLocaleString())
        ));
      });
    }).catch(() => {
      lbEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Could not load scores.</div>';
    });
  });

  return wrap;
}
