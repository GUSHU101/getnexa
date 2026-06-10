import { h, AdSlot } from '../core.js';

const CONTENT = {
  about: {
    title: 'About Nexa Arcade',
    body: `
      <p>Nexa Arcade is a free, browser-based gaming platform built for fast, instant fun. We believe great games should load in a tab, run smoothly on any device, and reward your time with meaningful progress — levels, achievements, leaderboards, and cosmetics you actually care about.</p>
      <h3>Our mission</h3>
      <p>Bring back the joy of the arcade — no installs, no paywalls to try anything, no intrusive ads in the middle of a round. Sign up takes 10 seconds, and from that moment on your progress lives with you on every device.</p>
      <h3>What's here today</h3>
      <ul>
        <li>Classic arcade titles rebuilt for the modern web: Snake, 2048, Tetris, Memory, Pong, Breakout, Minesweeper, Tic-Tac-Toe.</li>
        <li>Real-time multiplayer powered by Cloudflare Durable Objects — instant room creation, global low-latency.</li>
        <li>Live leaderboards, cross-device cloud saves, XP/level system, coins, achievements.</li>
      </ul>
      <h3>What's next</h3>
      <p>Weekly new titles, tournaments with prize pools, a creator program to publish your own games on Nexa, friend lists, and a lot more. Subscribe to our newsletter on the home page to follow along.</p>
      <h3>Built on Cloudflare</h3>
      <p>Every page, every game, every multiplayer room is served from Cloudflare's global edge. That means fast load times wherever you are, and infrastructure that scales with our community.</p>
    `,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `
      <p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
      <p>Nexa Arcade ("we", "our", "us") operates <a href="https://getnexa.space">getnexa.space</a> (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal information when you use our Service.</p>
      <h3>1. Information we collect</h3>
      <p>When you create an account we collect your email address and a username. We store a salted hash of your password (we never see or store your plaintext password). As you play we record your scores, progress data, XP, and in-game currency balance.</p>
      <p>We use essential cookies to keep you logged in. We may use anonymous analytics cookies to understand aggregate usage (e.g., which games are popular, whether pages load successfully).</p>
      <h3>2. How we use your information</h3>
      <p>We use your information to operate the Service — authenticate you, save your progress, display leaderboards, process purchases, and communicate with you about updates you've asked for (e.g., newsletter opt-in).</p>
      <h3>3. Advertising</h3>
      <p>We display advertising from Google AdSense and other third-party networks. These networks may use cookies to serve ads based on your prior visits. You can opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener">Google Ads Settings</a>.</p>
      <h3>4. Data sharing</h3>
      <p>We do not sell your personal information. We share it only with service providers that help us run the Service (hosting, payments, analytics, email) under strict confidentiality obligations.</p>
      <h3>5. Your rights</h3>
      <p>You can request access to, correction of, or deletion of your personal data at any time by emailing <a href="mailto:privacy@getnexa.space">privacy@getnexa.space</a>.</p>
      <h3>6. Children</h3>
      <p>Nexa Arcade is not directed to children under 13. We do not knowingly collect personal information from children under 13.</p>
      <h3>7. Changes</h3>
      <p>We may update this policy. We will post the new policy on this page and update the "last updated" date above.</p>
      <h3>8. Contact</h3>
      <p>Questions? Email <a href="mailto:privacy@getnexa.space">privacy@getnexa.space</a>.</p>
    `,
  },
  terms: {
    title: 'Terms of Service',
    body: `
      <p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
      <h3>1. Acceptance</h3>
      <p>By using Nexa Arcade you agree to these Terms. If you do not agree, do not use the Service.</p>
      <h3>2. Accounts</h3>
      <p>You are responsible for safeguarding your password and for any activity under your account. Don't share your account. One person, one account.</p>
      <h3>3. Acceptable use</h3>
      <p>Don't cheat, script, or exploit. Don't harass other players. Don't try to break the Service. We may suspend accounts that violate these rules.</p>
      <h3>4. Purchases and subscriptions</h3>
      <p>All purchases are final unless required by law. Subscriptions renew automatically until cancelled. You can cancel at any time from your account.</p>
      <h3>5. Virtual items</h3>
      <p>In-game currency ("coins") and virtual items have no real-world monetary value and cannot be exchanged outside the Service.</p>
      <h3>6. Disclaimer</h3>
      <p>The Service is provided "as is" without warranty of any kind. We are not liable for lost progress, downtime, or any indirect damages.</p>
      <h3>7. Termination</h3>
      <p>You can delete your account at any time. We may suspend or terminate accounts that violate these Terms.</p>
      <h3>8. Changes</h3>
      <p>We may update these Terms. Continued use after the update constitutes acceptance.</p>
      <h3>9. Contact</h3>
      <p>Email <a href="mailto:legal@getnexa.space">legal@getnexa.space</a>.</p>
    `,
  },
  cookies: {
    title: 'Cookie Policy',
    body: `
      <p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
      <p>We use cookies to keep you logged in (<code>nexa_session</code>), measure how the site is performing, and serve relevant ads. You can disable cookies in your browser; some parts of the Service (like being logged in) will not work without them.</p>
      <h3>Essential cookies</h3>
      <ul><li><code>nexa_session</code> — authenticates your session. Required for login.</li></ul>
      <h3>Analytics cookies</h3>
      <p>We use anonymous analytics to measure aggregate site health. No personal information is shared with third parties.</p>
      <h3>Advertising cookies</h3>
      <p>Google AdSense and partner networks may set cookies to show you personalized ads. See <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">Google's policies</a> or opt out at <a href="https://optout.aboutads.info" target="_blank" rel="noopener">aboutads.info</a>.</p>
    `,
  },
  contact: {
    title: 'Contact',
    body: `
      <p>Need help? Want to partner? Found a bug? We'd love to hear from you.</p>
      <ul>
        <li>General: <a href="mailto:hello@getnexa.space">hello@getnexa.space</a></li>
        <li>Support: <a href="mailto:support@getnexa.space">support@getnexa.space</a></li>
        <li>Privacy: <a href="mailto:privacy@getnexa.space">privacy@getnexa.space</a></li>
        <li>Legal: <a href="mailto:legal@getnexa.space">legal@getnexa.space</a></li>
      </ul>
      <p>We reply within 1-2 business days.</p>
    `,
  },
};

export function StaticPage(key) {
  const c = CONTENT[key];
  if (!c) return h('div', { class: 'container section' }, h('h2', {}, 'Not found'));
  return h('div', { class: 'container section', style: 'max-width: 820px;' },
    h('h1', {}, c.title),
    h('div', { class: 'panel', html: c.body }),
    AdSlot('inContent')
  );
}
