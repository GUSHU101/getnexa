import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/* ═══════════════════════════════════════════════════════════════
   NEXA ARCADE — Live Mouse-Reactive Wallpaper Engine v2
   One particle field that MORPHS into a different formation +
   motion + color for every route, and reacts to the cursor
   (parallax sway + a glowing cursor light that drags the field).
   Public API preserved: mountBackground, setRoute, setAdaptiveTheme
   ═══════════════════════════════════════════════════════════════ */

let scene, camera, renderer, points, geo, posAttr, decor, cursorLight, raf = 0;
let base, cur, seeds;                 // Float32 buffers: target / current / stable randoms
let t = 0;
let mode = null, modeKey = '';
let camZ = 100, camZTarget = 100;

const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const COUNT = reduced ? 1400 : 4200;

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

/* ── Per-route visual identity ──
   formation = spatial shape · motion = how it animates · color/accent · cam = camera depth */
const MODES = {
  home:        { color: 0x00e5ff, accent: 0x7c3aed, formation: 'nebula',   motion: 'swirl',   size: 2.2, speed: 1.0, cam: 100, decor: true },
  games:       { color: 0x00e5ff, accent: 0x00b4ff, formation: 'tunnel',   motion: 'rush',    size: 2.8, speed: 1.6, cam: 70 },
  arena:       { color: 0xff3b5c, accent: 0xff7b29, formation: 'storm',     motion: 'turb',    size: 2.6, speed: 2.1, cam: 90 },
  tournaments: { color: 0xf59e0b, accent: 0xffd166, formation: 'orbits',    motion: 'orbit',   size: 2.7, speed: 1.0, cam: 110 },
  leaderboards:{ color: 0x10b981, accent: 0x6ee7b7, formation: 'rise',      motion: 'riseM',   size: 2.3, speed: 1.3, cam: 100 },
  blog:        { color: 0xa855f7, accent: 0x7c3aed, formation: 'drift',     motion: 'driftM',  size: 2.0, speed: 0.5, cam: 120 },
  shop:        { color: 0xf59e0b, accent: 0xfff1a8, formation: 'nebula',    motion: 'twinkle', size: 2.5, speed: 0.7, cam: 100 },
  account:     { color: 0x00e5ff, accent: 0x7c3aed, formation: 'gridwave',  motion: 'wave',    size: 2.2, speed: 1.0, cam: 130 },
  creators:    { color: 0xa855f7, accent: 0x00e5ff, formation: 'helix',     motion: 'orbit',   size: 2.3, speed: 1.0, cam: 110 },
  governance:  { color: 0x10b981, accent: 0x00e5ff, formation: 'orbits',    motion: 'orbit',   size: 2.2, speed: 0.8, cam: 110 },
  default:     { color: 0x00e5ff, accent: 0x7c3aed, formation: 'nebula',    motion: 'swirl',   size: 2.0, speed: 0.7, cam: 100 },
};

/* ── floating wireframe controllers (home decor only) ── */
function createController() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.08 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(2, 4, 4, 12), mat);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2 });
  group.userData.btnMat = btnMat;
  for (let i = 0; i < 4; i++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), btnMat);
    btn.position.set(2, 1, (i - 1.5));
    group.add(btn);
  }
  return group;
}

/* ── formation builder: writes target positions into `base` ── */
function buildFormation(name) {
  const cols = Math.ceil(Math.sqrt(COUNT));
  for (let i = 0; i < COUNT; i++) {
    const sa = seeds[i * 4], sb = seeds[i * 4 + 1], sc = seeds[i * 4 + 2], sd = seeds[i * 4 + 3];
    let x = 0, y = 0, z = 0;
    switch (name) {
      case 'tunnel': {
        const a = sa * Math.PI * 2, r = 130 + sb * 60;
        x = Math.cos(a) * r; y = Math.sin(a) * r; z = -1000 + sc * 1120;
        break;
      }
      case 'storm': {
        const r = 90 + sa * 240, th = sb * Math.PI * 2, ph = Math.acos(2 * sc - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.sin(ph) * Math.sin(th); z = r * Math.cos(ph) - 40;
        break;
      }
      case 'orbits': {
        const ring = Math.floor(sa * 5), r = 110 + ring * 75 + sb * 14, a = sc * Math.PI * 2;
        x = Math.cos(a) * r; y = Math.sin(a) * r; z = (sd - 0.5) * 70;
        break;
      }
      case 'rise': {
        x = (sa - 0.5) * 1000; z = (sb - 0.5) * 520 - 60; y = (sc - 0.5) * 1000;
        break;
      }
      case 'drift': {
        x = (sa - 0.5) * 1200; y = (sb - 0.5) * 780; z = (sc - 0.5) * 760 - 80;
        break;
      }
      case 'gridwave': {
        const col = i % cols, row = Math.floor(i / cols), sp = 26;
        x = (col - cols / 2) * sp; y = (row - cols / 2) * sp; z = 0;
        break;
      }
      case 'helix': {
        const turns = sa * Math.PI * 10, r = 150 + sb * 20, off = sd < 0.5 ? 0 : Math.PI;
        x = Math.cos(turns + off) * r; z = Math.sin(turns + off) * r; y = (sa - 0.5) * 950;
        break;
      }
      case 'nebula':
      default: {
        const r = 180 + sa * 520, th = sb * Math.PI * 2, ph = Math.acos(2 * sc - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.sin(ph) * Math.sin(th); z = r * Math.cos(ph) - 100;
      }
    }
    base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
  }
}

export function mountBackground() {
  if (scene) return;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.z = camZ;

  renderer = new THREE.WebGLRenderer({ antialias: !reduced, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.id = 'bg-3d';
  document.body.prepend(canvas);

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.PointLight(0x00e5ff, 1, 800);
  key.position.set(60, 60, 80); key.name = 'adaptiveLight';
  scene.add(key);
  // cursor-driven light that "drags" through the field
  cursorLight = new THREE.PointLight(0x00e5ff, 1.4, 600);
  cursorLight.position.set(0, 0, 160);
  scene.add(cursorLight);

  // particle field
  seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  base = new Float32Array(COUNT * 3);
  cur = new Float32Array(COUNT * 3);
  buildFormation('nebula');
  cur.set(base);

  geo = new THREE.BufferGeometry();
  posAttr = new THREE.Float32BufferAttribute(cur, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  const pMat = new THREE.PointsMaterial({
    size: 2.2, color: 0x00e5ff, transparent: true, opacity: 0.62,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  points = new THREE.Points(geo, pMat);
  scene.add(points);

  // decorative controllers (home only)
  decor = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const c = createController();
    c.position.set((Math.random() - 0.5) * 220, (Math.random() - 0.5) * 220, (Math.random() - 0.5) * 120 - 60);
    c.userData.rotX = Math.random() * 0.008 + 0.002;
    c.userData.rotY = Math.random() * 0.008 + 0.002;
    decor.add(c);
  }
  scene.add(decor);

  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener('resize', onResize);

  if (!modeKey) applyMode('home');

  function tick() {
    raf = requestAnimationFrame(tick);
    const sp = mode ? mode.speed : 1;
    t += 0.016 * sp;
    const m = mode ? mode.motion : 'swirl';

    // formation-level motion baked into `base`
    if (m === 'rush') {
      for (let i = 0; i < COUNT; i++) {
        const k = i * 3 + 2;
        base[k] += 4.2 * sp;
        if (base[k] > 120) { base[k] -= 1120; cur[k] = base[k]; }
      }
    } else if (m === 'riseM') {
      for (let i = 0; i < COUNT; i++) {
        const k = i * 3 + 1;
        base[k] += 2.6 * sp;
        if (base[k] > 500) { base[k] -= 1000; cur[k] = base[k]; }
      }
    } else if (m === 'wave') {
      for (let i = 0; i < COUNT; i++) {
        base[i * 3 + 2] = Math.sin(t * 1.4 + base[i * 3] * 0.02 + base[i * 3 + 1] * 0.02) * 42;
      }
    }

    // morph current → target
    for (let i = 0; i < base.length; i++) cur[i] += (base[i] - cur[i]) * 0.06;
    posAttr.needsUpdate = true;

    // group-level motion
    if (points) {
      if (m === 'swirl')      { points.rotation.y += 0.0006 * sp; points.rotation.x += 0.0002 * sp; }
      else if (m === 'orbit') { points.rotation.z += 0.0022 * sp; }
      else if (m === 'turb')  { points.rotation.y += 0.0045 * sp; points.rotation.z += 0.0015 * sp; }
      else if (m === 'driftM'){ points.rotation.y += 0.0003 * sp; }
      else if (m === 'twinkle'){ points.rotation.y += 0.0004 * sp; points.material.opacity = 0.5 + Math.sin(t * 3) * 0.18; }
      else                    { points.rotation.y += 0.0005 * sp; }
    }

    // decor controllers (home)
    if (decor && decor.visible) {
      decor.children.forEach((c, i) => {
        c.rotation.x += c.userData.rotX; c.rotation.y += c.userData.rotY;
        c.position.y += Math.sin(t * 0.6 + i) * 0.06;
      });
      decor.rotation.y += 0.0004;
    }

    // mouse parallax — the field & camera sway toward the cursor
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    camZ += (camZTarget - camZ) * 0.06;
    camera.position.x += (mouse.x * 70 - camera.position.x) * 0.05;
    camera.position.y += (-mouse.y * 70 - camera.position.y) * 0.05;
    camera.position.z = camZ;
    camera.lookAt(0, 0, mode && mode.formation === 'tunnel' ? -200 : 0);

    // cursor light drags through 3-D space
    cursorLight.position.x += (mouse.x * 340 - cursorLight.position.x) * 0.08;
    cursorLight.position.y += (-mouse.y * 340 - cursorLight.position.y) * 0.08;

    renderer.render(scene, camera);
  }
  tick();
}

function onResize() {
  if (!camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function applyMode(key) {
  const next = MODES[key] || MODES.default;
  const formationChanged = !mode || mode.formation !== next.formation;
  mode = next; modeKey = key;
  camZTarget = next.cam;
  if (decor) decor.visible = !!next.decor;
  if (formationChanged && base) {
    buildFormation(next.formation);
    // reset rotation so new formations read cleanly
    if (points) { points.rotation.set(0, 0, 0); }
  }
  tweenColor(next.color, next.accent);
  if (points) points.material.size = next.size;
}

function tweenColor(hex, accentHex) {
  const apply = (target, h) => {
    const r = ((h >> 16) & 0xff) / 255, g = ((h >> 8) & 0xff) / 255, b = (h & 0xff) / 255;
    if (typeof gsap !== 'undefined') gsap.to(target, { r, g, b, duration: 1.2, overwrite: true });
    else target.setRGB(r, g, b);
  };
  if (points) apply(points.material.color, hex);
  if (cursorLight) apply(cursorLight.color, accentHex);
  const light = scene && scene.getObjectByName('adaptiveLight');
  if (light) apply(light.color, hex);
  // tint decor buttons
  if (decor) decor.children.forEach(c => c.userData.btnMat && apply(c.userData.btnMat.emissive, accentHex));
}

export function setRoute(path) {
  const seg = (path || '/').split('/').filter(Boolean)[0] || 'home';
  const key = (path === '/' || !seg) ? 'home' : (MODES[seg] ? seg : 'default');
  if (key !== modeKey) applyMode(key);
}

/* kept for game-hover theming (games page calls this) */
export function setAdaptiveTheme(hexColor) {
  if (!scene) return;
  const light = scene.getObjectByName('adaptiveLight');
  const r = ((hexColor >> 16) & 0xFF) / 255, g = ((hexColor >> 8) & 0xFF) / 255, b = (hexColor & 0xFF) / 255;
  if (typeof gsap !== 'undefined') {
    if (light) gsap.to(light.color, { r, g, b, duration: 1.2, overwrite: true });
    if (points) gsap.to(points.material.color, { r, g, b, duration: 1.2, overwrite: true });
  } else {
    if (light) light.color.setRGB(r, g, b);
    if (points) points.material.color.setRGB(r, g, b);
  }
}
