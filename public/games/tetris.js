export function mountTetris(root, { onScore }) {
  root.innerHTML = '';
  const COLS = 10, ROWS = 20, BLK = 26;
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.width = COLS * BLK; canvas.height = ROWS * BLK;
  const ctx = canvas.getContext('2d');

  const hud = document.createElement('div');
  hud.style.cssText = 'display:flex; gap:14px; justify-content:center; margin-bottom:10px; font-weight:700;';
  hud.innerHTML = 'Score: <span id="sc">0</span> · Lines: <span id="ln">0</span> · Level: <span id="lv">1</span>';
  root.appendChild(hud);
  root.appendChild(canvas);
  const help = document.createElement('div');
  help.style.cssText = 'text-align:center; margin-top:10px; color:var(--muted); font-size:13px;';
  help.innerHTML = '← → move · ↑ rotate · ↓ soft drop · Space hard drop · P pause<br>Touch: swipe ←/→ to move · tap to rotate · swipe ↓ to drop';
  root.appendChild(help);

  const COLORS = ['#000', '#24d1a1', '#5b8cff', '#7c5cff', '#ffb020', '#ff5b6b', '#ff8cf0', '#5af0ea'];
  const PIECES = [
    [[1, 1, 1, 1]],
    [[2, 0, 0], [2, 2, 2]],
    [[0, 0, 3], [3, 3, 3]],
    [[4, 4], [4, 4]],
    [[0, 5, 5], [5, 5, 0]],
    [[0, 6, 0], [6, 6, 6]],
    [[7, 7, 0], [0, 7, 7]],
  ];

  let grid, piece, px, py, score, lines, level, dropInt, dropAcc, last, paused, over;

  function newPiece() {
    const s = PIECES[Math.floor(Math.random() * PIECES.length)].map(r => r.slice());
    return s;
  }
  function rotate(m) {
    const R = m.length, C = m[0].length;
    const out = Array.from({ length: C }, () => Array(R).fill(0));
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) out[c][R - 1 - r] = m[r][c];
    return out;
  }
  function collide(m, x, y) {
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[0].length; c++) {
      if (!m[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && grid[ny][nx]) return true;
    }
    return false;
  }
  function merge() {
    for (let r = 0; r < piece.length; r++) for (let c = 0; c < piece[0].length; c++) {
      if (piece[r][c] && py + r >= 0) grid[py + r][px + c] = piece[r][c];
    }
  }
  function clearLines() {
    let n = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(v => v)) { grid.splice(r, 1); grid.unshift(Array(COLS).fill(0)); n++; r++; }
    }
    if (n) {
      const pts = [0, 100, 300, 500, 800][n] * level;
      score += pts; lines += n;
      level = 1 + Math.floor(lines / 10);
      dropInt = Math.max(0.05, 0.8 - (level - 1) * 0.07);
      updateHud();
    }
  }
  function spawn() {
    piece = newPiece();
    px = Math.floor(COLS / 2) - Math.ceil(piece[0].length / 2);
    py = -1;
    if (collide(piece, px, py + 1)) { over = true; if (score > 0 && onScore) onScore(score); }
  }
  function updateHud() {
    document.getElementById('sc').textContent = score;
    document.getElementById('ln').textContent = lines;
    document.getElementById('lv').textContent = level;
  }
  function reset() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0; lines = 0; level = 1; dropInt = 0.8; dropAcc = 0; last = performance.now(); paused = false; over = false;
    spawn(); updateHud(); requestAnimationFrame(loop);
  }

  function softDrop() { if (!collide(piece, px, py + 1)) py++; else { merge(); clearLines(); spawn(); } }
  function hardDrop() { while (!collide(piece, px, py + 1)) py++; merge(); clearLines(); spawn(); }

  function draw() {
    ctx.fillStyle = '#05091a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = grid[r][c];
      if (v) { ctx.fillStyle = COLORS[v]; ctx.fillRect(c * BLK + 1, r * BLK + 1, BLK - 2, BLK - 2); }
    }
    for (let r = 0; r < piece.length; r++) for (let c = 0; c < piece[0].length; c++) {
      if (!piece[r][c]) continue;
      const x = (px + c) * BLK, y = (py + r) * BLK;
      if (y >= 0) { ctx.fillStyle = COLORS[piece[r][c]]; ctx.fillRect(x + 1, y + 1, BLK - 2, BLK - 2); }
    }
    if (over) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
      ctx.font = '14px sans-serif';
      ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 24);
    } else if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
    }
  }

  function loop(ts) {
    const dt = (ts - last) / 1000; last = ts;
    if (!paused && !over) { dropAcc += dt; if (dropAcc >= dropInt) { dropAcc = 0; softDrop(); } }
    draw();
    if (!over) requestAnimationFrame(loop);
  }

  const onKey = (e) => {
    if (over) { if (e.key === 'r' || e.key === 'R') reset(); return; }
    if (e.key === 'p' || e.key === 'P') { paused = !paused; return; }
    if (paused) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { if (!collide(piece, px - 1, py)) px--; }
    else if (e.key === 'ArrowRight' || e.key === 'd') { if (!collide(piece, px + 1, py)) px++; }
    else if (e.key === 'ArrowDown' || e.key === 's') { softDrop(); }
    else if (e.key === 'ArrowUp' || e.key === 'w') { const r = rotate(piece); if (!collide(r, px, py)) piece = r; }
    else if (e.key === ' ') { e.preventDefault(); hardDrop(); }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  // ── Touch controls: swipe to move/drop, tap to rotate ──
  let tStartX = 0, tStartY = 0, tStartT = 0, tMoved = false;
  const STEP = 28; // px per horizontal cell-move
  let accumX = 0;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    tStartX = t.clientX; tStartY = t.clientY; tStartT = Date.now(); tMoved = false; accumX = 0;
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (over || paused) return;
    const t = e.touches[0];
    const dx = t.clientX - tStartX, dy = t.clientY - tStartY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) tMoved = true;
    // Horizontal stepping
    accumX += dx - (accumX);
    while (Math.abs(t.clientX - tStartX) >= STEP) {
      if (t.clientX - tStartX > 0) { if (!collide(piece, px + 1, py)) px++; tStartX += STEP; }
      else { if (!collide(piece, px - 1, py)) px--; tStartX += -STEP; }
    }
    // Downward swipe = soft drop
    if (dy > STEP) { softDrop(); tStartY = t.clientY; }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    if (over) { reset(); return; }
    if (!tMoved && !paused) { const r = rotate(piece); if (!collide(r, px, py)) piece = r; } // tap = rotate
  });

  reset();

  // Cleanup when the stage is torn down (route change re-renders #app)
  const cleanup = () => { window.removeEventListener('keydown', onKey); over = true; };
  const mo = new MutationObserver(() => {
    if (!document.body.contains(canvas)) { cleanup(); mo.disconnect(); }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
