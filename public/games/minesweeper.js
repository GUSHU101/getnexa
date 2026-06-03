export function mountMinesweeper(root, { onScore }) {
  root.innerHTML = '';
  const W = 12, H = 12, MINES = 20;

  const hud = document.createElement('div');
  hud.style.cssText = 'display:flex; justify-content:center; gap:14px; margin-bottom:10px; font-weight:700;';
  hud.innerHTML = 'Mines left: <span id="mn">' + MINES + '</span> · <button id="rst" class="btn btn-sm">Restart</button>';
  root.appendChild(hud);

  const grid = document.createElement('div'); grid.className = 'mine-grid';
  grid.style.gridTemplateColumns = `repeat(${W}, 28px)`;
  root.appendChild(grid);
  const help = document.createElement('div');
  help.style.cssText = 'text-align:center; margin-top:10px; color:var(--muted); font-size:13px;';
  help.innerHTML = 'Left-click: reveal · Right-click: flag · Clear all non-mines to win';
  root.appendChild(help);

  let cells = [], mines = new Set(), opened = 0, flags = 0, start = Date.now(), over = false;
  function key(x, y) { return y * W + x; }
  function neighbors(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push([nx, ny]);
    }
    return out;
  }
  function placeMines(avoid) {
    while (mines.size < MINES) {
      const k = Math.floor(Math.random() * W * H);
      if (k === avoid) continue;
      mines.add(k);
    }
  }
  function countAdj(x, y) { return neighbors(x, y).filter(([a, b]) => mines.has(key(a, b))).length; }
  function setStatus(msg) {
    help.innerHTML = msg || 'Left-click / tap: reveal · Right-click / long-press: flag · Clear all non-mines to win';
  }
  function checkWin() {
    if (opened === W * H - MINES) {
      over = true;
      const sec = Math.round((Date.now() - start) / 1000);
      const score = Math.max(100, 3000 - sec * 10);
      setStatus(`🏆 Swept clean in ${sec}s! Score: ${score}`);
      if (onScore) onScore(score);
    }
  }
  function open(x, y) {
    if (over) return;
    const k = key(x, y); const el = cells[k];
    if (el.classList.contains('open') || el.classList.contains('flag')) return;
    if (mines.size === 0) placeMines(k);
    el.classList.add('open'); opened++;
    if (mines.has(k)) {
      over = true; el.classList.add('mine'); el.textContent = '💣';
      for (const m of mines) { cells[m].classList.add('mine'); cells[m].textContent = '💣'; }
      setStatus('💥 Boom! Hit a mine. Press Restart to try again.');
      return;
    }
    const n = countAdj(x, y);
    if (n > 0) { el.textContent = String(n); el.style.color = ['', '#5b8cff', '#24d1a1', '#ffb020', '#ff5b6b', '#b77cff', '#5af0ea', '#fff', '#ccc'][n]; }
    else {
      for (const [nx, ny] of neighbors(x, y)) open(nx, ny);
    }
    checkWin();
  }
  function flag(x, y) {
    const el = cells[key(x, y)];
    if (el.classList.contains('open')) return;
    el.classList.toggle('flag');
    el.textContent = el.classList.contains('flag') ? '🚩' : '';
    flags += el.classList.contains('flag') ? 1 : -1;
    document.getElementById('mn').textContent = MINES - flags;
  }

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = document.createElement('div'); c.className = 'mine-cell';
    let lpTimer = null, longPressed = false;
    c.addEventListener('click', () => { if (!longPressed) open(x, y); longPressed = false; });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); flag(x, y); });
    // Touch long-press to flag
    c.addEventListener('touchstart', () => {
      longPressed = false;
      lpTimer = setTimeout(() => { longPressed = true; flag(x, y); if (navigator.vibrate) navigator.vibrate(15); }, 350);
    }, { passive: true });
    c.addEventListener('touchend', () => clearTimeout(lpTimer));
    c.addEventListener('touchmove', () => clearTimeout(lpTimer), { passive: true });
    grid.appendChild(c); cells.push(c);
  }
  document.getElementById('rst').onclick = () => mountMinesweeper(root, { onScore });
}
