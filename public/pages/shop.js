import { h, api, AdSlot, toast, state, route } from '../core.js';
import { trackEvent } from '../firebase.js';

export function ShopPage() {
  const grid = h('div', { class: 'shop-grid' });
  const page = h('div', { class: 'container section' },
    h('div', { class: 'section-head' },
      h('div', {},
        h('div', { class: 'section-eyebrow' }, 'Shop'),
        h('h1', {}, 'Power up'),
        h('p', { style: 'max-width: 640px;' }, 'Subscriptions remove ads and unlock premium features. Coin packs give in-game currency. Cosmetics personalize your profile. Everything pays via Stripe or PayPal — no sign-ups anywhere else.'),
      )
    ),
    AdSlot('inContent'),

    // Subscription tier comparison
    h('div', { class: 'sub-tiers', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:28px;' },
      // Nexa Starter — $2.99
      h('div', { class: 'panel sub-tier-card', style: 'border:2px solid var(--cyan);position:relative;' },
        h('div', { class: 'section-eyebrow', style: 'color:var(--cyan);margin-bottom:8px;' }, '⭐ STARTER'),
        h('div', { style: 'font-size:32px;font-weight:900;color:var(--text);margin-bottom:4px;' }, '$2.99',
          h('span', { style: 'font-size:14px;color:var(--text-dim);' }, '/mo')
        ),
        h('ul', { style: 'list-style:none;margin:16px 0 20px;display:flex;flex-direction:column;gap:8px;' },
          ...['✅ No Ads Ever','✅ Custom Avatars','✅ Tournament Access','✅ 200 Coins/Month','✅ Leaderboard Priority Badge'].map(f =>
            h('li', { style: 'font-size:13px;color:var(--text-dim);' }, f)
          )
        ),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
          h('button', { class: 'btn btn-primary btn-block', onClick: () => buyStripe('starter_month') }, '🚀 Start for $2.99/mo'),
          h('button', { class: 'btn btn-block', style: 'background:#ffc439;color:#000;border-color:transparent;font-weight:800;', onClick: () => buyPaypal('starter_month') }, '💛 PayPal'),
        ),
        h('p', { style: 'font-size:10px;color:var(--text-muted);text-align:center;margin-top:10px;' }, 'Cancel anytime. No contracts.')
      ),

      // Nexa Operative — $4.99
      h('div', { class: 'panel sub-tier-card', style: 'border:1px solid var(--purple);position:relative;' },
        h('div', { class: 'section-eyebrow', style: 'color:var(--purple-bright);margin-bottom:8px;' }, '⚡ OPERATIVE'),
        h('div', { style: 'font-size:32px;font-weight:900;color:var(--text);margin-bottom:4px;' }, '$4.99',
          h('span', { style: 'font-size:14px;color:var(--text-dim);' }, '/mo')
        ),
        h('ul', { style: 'list-style:none;margin:16px 0 20px;display:flex;flex-direction:column;gap:8px;' },
          ...['✅ Everything in Starter','✅ Epic Exclusive Skins','✅ 500 Coins/Month','✅ Priority Support','✅ Early Game Access'].map(f =>
            h('li', { style: 'font-size:13px;color:var(--text-dim);' }, f)
          )
        ),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
          h('button', { class: 'btn btn-block', style: 'background:var(--purple-bright);color:#fff;border-color:var(--purple-bright);', onClick: () => buyStripe('operative_tier') }, '⚡ Go Operative — $4.99/mo'),
          h('button', { class: 'btn btn-block', style: 'background:#ffc439;color:#000;border-color:transparent;font-weight:800;', onClick: () => buyPaypal('operative_tier') }, '💛 PayPal'),
        )
      ),

      // Nexa Legend — $9.99
      h('div', { class: 'panel sub-tier-card', style: 'border:1px solid var(--gold);position:relative;' },
        h('div', { class: 'section-eyebrow', style: 'color:var(--gold);margin-bottom:8px;' }, '👑 LEGEND'),
        h('div', { style: 'font-size:32px;font-weight:900;color:var(--text);margin-bottom:4px;' }, '$9.99',
          h('span', { style: 'font-size:14px;color:var(--text-dim);' }, '/mo')
        ),
        h('ul', { style: 'list-style:none;margin:16px 0 20px;display:flex;flex-direction:column;gap:8px;' },
          ...['✅ Everything in Operative','✅ Legend Gold Badge','✅ 1,000 Coins/Month','✅ Exclusive Legend Tournaments','✅ Username color effect'].map(f =>
            h('li', { style: 'font-size:13px;color:var(--text-dim);' }, f)
          )
        ),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
          h('button', { class: 'btn btn-block', style: 'background:var(--gold);color:#000;border-color:var(--gold);', onClick: () => buyStripe('legend_month') }, '👑 Go Legend — $9.99/mo'),
          h('button', { class: 'btn btn-block', style: 'background:#ffc439;color:#000;border-color:transparent;font-weight:800;', onClick: () => buyPaypal('legend_month') }, '💛 PayPal'),
        )
      )
    ),

    // Stripe + PayPal trust badges
    h('div', { style: 'display:flex;align-items:center;gap:16px;margin-bottom:28px;flex-wrap:wrap;' },
      h('span', { style: 'font-size:11px;color:var(--text-muted);' }, '🔒 Payments secured by'),
      h('span', { style: 'background:rgba(99,91,255,0.15);border:1px solid rgba(99,91,255,0.3);border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;color:#7c73ff;' }, 'Stripe'),
      h('span', { style: 'background:rgba(255,196,57,0.1);border:1px solid rgba(255,196,57,0.3);border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;color:#ffc439;' }, 'PayPal'),
      h('span', { style: 'font-size:11px;color:var(--text-muted);' }, '• Cancel anytime • No contracts')
    ),
    grid,
    h('div', { class: 'panel', style: 'margin-top: 28px;' },
      h('h3', {}, 'Spend your 🪙 coins'),
      h('p', {}, 'Earn coins by playing. Redeem them for cosmetics, hints, and extras — no purchase required.'),
      h('div', { class: 'row', style: 'margin-top: 10px;' },
        h('button', { class: 'btn', onClick: () => spendCoins('theme_arcade_free', 500) }, 'Arcade Theme — 500 🪙'),
        h('button', { class: 'btn', onClick: () => spendCoins('hint_bundle_small', 250) }, 'Hint Bundle — 250 🪙'),
        h('button', { class: 'btn', onClick: () => spendCoins('extra_life_1', 100) }, 'Extra Life — 100 🪙'),
      )
    )
  );

  api('/api/shop/products').then(({ products }) => {
    grid.innerHTML = '';
    products.forEach(p => grid.appendChild(Product(p)));
  }).catch(() => {});

  return page;
}

function Product(p) {
  return h('div', { class: 'product' },
    h('div', {},
      h('div', { class: 'type' }, p.type + (p.recurring ? ' · Monthly' : '')),
      h('h3', { style: 'margin: 6px 0 2px; font-size: 17px;' }, p.name),
      h('div', { class: 'price' }, `$${(p.price_cents / 100).toFixed(2)}`),
    ),
    h('div', { class: 'product-actions' },
      h('button', { class: 'btn btn-primary', onClick: () => buyStripe(p.id) }, 'Pay with Card'),
      h('button', { class: 'btn', onClick: () => buyPaypal(p.id), style: 'background: #ffc439; color: #000; border-color: transparent; font-weight: 800;' }, 'PayPal'),
    )
  );
}

async function buyStripe(productId) {
  if (!state.user) { toast('Please log in', ''); route('/login'); return; }
  trackEvent('begin_checkout', { method: 'stripe', item_id: productId });
  try {
    const res = await api('/api/pay/stripe/checkout', { method: 'POST', body: { product_id: productId } });
    if (res.url) location.href = res.url;
  } catch (e) {
    if (String(e.message).toLowerCase().includes('not configured')) {
      toast('Stripe not yet activated by admin — try PayPal or spend coins', 'error');
    } else toast(e.message, 'error');
  }
}

async function buyPaypal(productId) {
  if (!state.user) { toast('Please log in', ''); route('/login'); return; }
  trackEvent('begin_checkout', { method: 'paypal', item_id: productId });
  try {
    const res = await api('/api/pay/paypal/create', { method: 'POST', body: { product_id: productId } });
    if (res.url) location.href = res.url;
  } catch (e) {
    if (String(e.message).toLowerCase().includes('not configured')) {
      toast('PayPal not yet activated by admin — try Stripe or spend coins', 'error');
    } else toast(e.message, 'error');
  }
}

async function spendCoins(itemId, cost) {
  if (!state.user) { toast('Please log in first', ''); route('/login'); return; }
  try {
    const res = await api('/api/shop/spend-coins', { method: 'POST', body: { item_id: itemId, cost } });
    state.user.coins = res.remaining_coins;
    toast('Redeemed! Item added to your inventory.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

export function CheckoutPage({ query }) {
  const provider = query.get('provider') || 'stripe';
  const status = query.get('status') || '';
  const order = query.get('order');
  const paypalToken = query.get('token'); // PayPal returns ?token=ORDER_ID&PayerID=...

  const container = h('div', { class: 'container section', style: 'max-width: 640px;' });

  if (provider === 'paypal' && paypalToken && status !== 'cancel') {
    container.appendChild(h('div', { class: 'panel' },
      h('h1', {}, 'Finalizing your PayPal payment…'),
      h('p', {}, 'Please wait.')
    ));
    api('/api/pay/paypal/capture', { method: 'POST', body: { paypal_order_id: paypalToken } })
      .then((r) => {
        if (r.ok) { trackEvent('purchase', { method: 'paypal', transaction_id: paypalToken }); toast('Payment successful! 🎉', 'success'); route('/account'); }
        else { toast('Payment not completed.', 'error'); }
      })
      .catch((e) => toast(e.message, 'error'));
    return container;
  }

  if (status === 'success') {
    trackEvent('purchase', { method: provider, transaction_id: order });
    container.appendChild(h('div', { class: 'panel' },
      h('h1', {}, 'Payment received 🎉'),
      h('p', {}, `Order #${order} via ${provider}. Thanks for supporting Nexa Arcade! Your purchase is being applied to your account.`),
      h('div', { class: 'row' },
        h('a', { href: '/account', 'data-link': true, class: 'btn btn-primary' }, 'Go to account'),
        h('a', { href: '/games', 'data-link': true, class: 'btn' }, 'Back to games'),
      )
    ));
    return container;
  }
  if (status === 'cancel') {
    container.appendChild(h('div', { class: 'panel' },
      h('h1', {}, 'Payment cancelled'),
      h('p', {}, 'No charges were made. You can try again any time.'),
      h('a', { href: '/shop', 'data-link': true, class: 'btn btn-primary' }, 'Back to shop'),
    ));
    return container;
  }
  container.appendChild(h('div', { class: 'panel' },
    h('h1', {}, 'Checkout'),
    h('p', {}, `Order #${order} · ${provider}`),
    h('a', { href: '/shop', 'data-link': true, class: 'btn' }, 'Back to shop')
  ));
  return container;
}
