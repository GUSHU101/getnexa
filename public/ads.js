/* ═══════════════════════════════════════════════════════════
   NEXA ARCADE — AdSense configuration
   ───────────────────────────────────────────────────────────
   Revenue runs two ways, both real:

   1) AUTO ADS (live now): the page-level script in index.html lets
      AdSense auto-place ads. Just toggle "Auto ads" ON once in the
      AdSense dashboard for ca-pub-5800977493749262. No slot IDs needed.

   2) MANUAL UNITS (optional, more control): create ad units in
      AdSense → Ads → "By ad unit" → Display, then paste each unit's
      data-ad-slot number below. As soon as an ID is filled in, that
      placement renders a real responsive ad. Until then it renders
      NOTHING (no empty placeholder boxes — keeps the UI clean).
   ═══════════════════════════════════════════════════════════ */

export const AD_CLIENT = 'ca-pub-5800977493749262';

/** Tiers that never see ads (subscribers). */
export const PAID_TIERS = ['starter', 'operative', 'pro', 'legend', 'studio'];

/** Paste real ad-unit slot IDs (digits only, e.g. '1234567890'). */
export const AD_SLOTS = {
  inContent: '', // between home/games/shop sections
  inArticle: '', // inside blog articles & lists
  sidebar:   '', // game page rail / panels
};
