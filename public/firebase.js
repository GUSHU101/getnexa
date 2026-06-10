/* ═══════════════════════════════════════════════════════════
   NEXA ARCADE — Firebase (App + Analytics)
   Loaded from gstatic CDN as native ES modules (no bundler).
   NOTE: the web apiKey below is a PUBLIC client identifier, not a
   secret — Google designs it to ship in browser code. Real access
   is gated by Firebase Security Rules + authorized domains.
   ═══════════════════════════════════════════════════════════ */

const FIREBASE_VERSION = '11.6.1';
const cdn = (m) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${m}.js`;

export const firebaseConfig = {
  apiKey: 'AIzaSyC2VCBOszos800f-m8inp7XhJkLH4KFkKs',
  authDomain: 'gen-lang-client-0914367944.firebaseapp.com',
  projectId: 'gen-lang-client-0914367944',
  storageBucket: 'gen-lang-client-0914367944.firebasestorage.app',
  messagingSenderId: '76706851259',
  appId: '1:76706851259:web:ab51ea9855f4ab1cd93c9e',
  measurementId: 'G-TTRHLXYNQX',
};

let _app = null;
let _analytics = null;
let _logEvent = null;
let _ready = null;

/**
 * Initialize Firebase App + Analytics. Idempotent and fail-safe:
 * if the CDN is blocked (ad-blockers, offline), it resolves to null
 * instead of throwing, so the rest of the app keeps working.
 */
export function initFirebase() {
  if (_ready) return _ready;
  _ready = (async () => {
    try {
      const [{ initializeApp }, analyticsMod] = await Promise.all([
        import(cdn('app')),
        import(cdn('analytics')),
      ]);
      _app = initializeApp(firebaseConfig);

      // Analytics only works on http(s) with a measurementId present.
      const supported = await analyticsMod.isSupported().catch(() => false);
      if (supported && location.protocol.startsWith('http')) {
        _analytics = analyticsMod.getAnalytics(_app);
        _logEvent = analyticsMod.logEvent;
      }
      return _app;
    } catch (err) {
      console.warn('[firebase] init skipped:', err?.message || err);
      return null;
    }
  })();
  return _ready;
}

/** Log a single-page-app virtual page view. Safe to call any time. */
export function trackPageView(path = location.pathname, title = document.title) {
  if (_analytics && _logEvent) {
    try {
      _logEvent(_analytics, 'page_view', {
        page_path: path,
        page_title: title,
        page_location: location.href,
      });
    } catch {}
  }
}

/** Log a custom Analytics event. Safe to call any time. */
export function trackEvent(name, params = {}) {
  if (_analytics && _logEvent) {
    try { _logEvent(_analytics, name, params); } catch {}
  }
}

/** Resolve the initialized Firebase App (or null if unavailable). */
export async function getFirebaseApp() {
  await initFirebase();
  return _app;
}
