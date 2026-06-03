export function mountPong(root, { onScore, user }) {
  root.innerHTML = '';
  const isMultiplayer = new URL(location.href).searchParams.has('room');
  const roomId = isMultiplayer ? new URL(location.href).searchParams.get('room') : null;

  const W = 600, H = 400;
  const PAD_H = 80, PAD_W = 10;

  // Header/Status
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;';
  if (isMultiplayer) {
    header.innerHTML = `<div><b>Room:</b> <span style="background: var(--bg-2); padding:4px 8px; border-radius:6px; font-family: monospace;">${roomId}</span> <button id="copy" class="btn btn-sm" style="margin-left:8px;">Copy link</button></div>
      <div id="status" style="color: var(--muted);">Connecting…</div>`;
  } else {
    header.innerHTML = `<div>Single Player vs CPU</div><button id="go-mp" class="btn btn-sm btn-primary">Create Multiplayer Room</button>`;
  }
  root.appendChild(header);

  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas'; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const hud = document.createElement('div');
  hud.style.cssText = 'display:flex; justify-content:center; gap:20px; margin-bottom:10px; font-weight:700;';
  hud.innerHTML = 'You: <span id="sp">0</span> · <span id="opp-label">CPU</span>: <span id="sc">0</span>';
  root.appendChild(hud);
  root.appendChild(canvas);

  const help = document.createElement('div');
  help.style.cssText = 'text-align:center; margin-top:10px; color:var(--muted); font-size:13px;';
  help.innerHTML = 'Mouse / touch / ↑↓ to move paddle · First to 10 wins';
  root.appendChild(help);

  if (isMultiplayer) {
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex; justify-content:center; gap:10px; margin-top:12px;';
    controls.innerHTML = `<button id="rdy" class="btn btn-primary">I'm ready</button><button id="rst" class="btn">Reset</button>`;
    root.appendChild(controls);
  }

  // State
  let p1y = H / 2 - PAD_H / 2, p2y = H / 2 - PAD_H / 2;
  let sp = 0, sc = 0, over = false, won = false;
  let ball = { x: W / 2, y: H / 2, vx: 4, vy: 2, r: 8 };
  let mySide = 'left'; // default for SP

  // Input — map pointer Y into canvas coordinate space (canvas may be CSS-scaled)
  let mouseTargetY = H / 2;
  function pointerToCanvasY(clientY) {
    const r = canvas.getBoundingClientRect();
    return (clientY - r.top) * (H / r.height);
  }
  canvas.addEventListener('mousemove', (e) => { mouseTargetY = pointerToCanvasY(e.clientY); });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches[0]) mouseTargetY = pointerToCanvasY(e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches[0]) mouseTargetY = pointerToCanvasY(e.touches[0].clientY);
  }, { passive: true });
  const onKey = (e) => {
    if (e.key === 'ArrowUp') mouseTargetY -= 30;
    if (e.key === 'ArrowDown') mouseTargetY += 30;
    mouseTargetY = Math.max(PAD_H/2, Math.min(H - PAD_H/2, mouseTargetY));
  };
  window.addEventListener('keydown', onKey);
  // Cleanup keydown listener when the canvas is removed (route change)
  const _mo = new MutationObserver(() => {
    if (!document.body.contains(canvas)) { window.removeEventListener('keydown', onKey); over = true; _mo.disconnect(); }
  });
  _mo.observe(document.body, { childList: true, subtree: true });

  if (!isMultiplayer) {
    document.getElementById('go-mp').onclick = () => {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      const u = new URL(location.href); u.searchParams.set('room', code);
      location.href = u.toString();
    };
    startSinglePlayer();
  } else {
    document.getElementById('copy').onclick = () => { navigator.clipboard.writeText(location.href).catch(() => {}); };
    startMultiplayer();
  }

  function startSinglePlayer() {
    function reset() {
      ball = { x: W / 2, y: H / 2, vx: 4 * (Math.random() < 0.5 ? 1 : -1), vy: (Math.random() - 0.5) * 4, r: 8 };
    }
    function loop() {
      if (over) return;
      // Player
      p1y += ((mouseTargetY - PAD_H / 2) - p1y) * 0.28;
      p1y = Math.max(0, Math.min(H - PAD_H, p1y));
      // CPU
      const targetY = ball.y - PAD_H / 2;
      p2y += (targetY - p2y) * 0.08;
      p2y = Math.max(0, Math.min(H - PAD_H, p2y));

      ball.x += ball.vx; ball.y += ball.vy;
      if (ball.y < ball.r || ball.y > H - ball.r) ball.vy *= -1;
      if (ball.x - ball.r < PAD_W && ball.y > p1y && ball.y < p1y + PAD_H && ball.vx < 0) ball.vx *= -1.05;
      if (ball.x + ball.r > W - PAD_W && ball.y > p2y && ball.y < p2y + PAD_H && ball.vx > 0) ball.vx *= -1.05;

      if (ball.x < 0) { sc++; document.getElementById('sc').textContent = sc; reset(); }
      else if (ball.x > W) { sp++; document.getElementById('sp').textContent = sp; reset(); }

      if (sp >= 10 || sc >= 10) { over = true; won = sp > sc; }

      draw();
      if (over) {
        drawOverlay(won ? 'You win! — tap / press R to play again' : 'CPU wins — tap / press R to play again');
        if (won && onScore) onScore(sp * 50);
        return;
      }
      requestAnimationFrame(loop);
    }
    function restart() {
      sp = 0; sc = 0; over = false; won = false;
      document.getElementById('sp').textContent = '0';
      document.getElementById('sc').textContent = '0';
      p1y = H / 2 - PAD_H / 2; p2y = H / 2 - PAD_H / 2;
      reset();
      requestAnimationFrame(loop);
    }
    canvas.addEventListener('click', () => { if (over) restart(); });
    canvas.addEventListener('touchend', () => { if (over) restart(); });
    window.addEventListener('keydown', (e) => { if (over && (e.key === 'r' || e.key === 'R')) restart(); });
    requestAnimationFrame(loop);
  }

  function startMultiplayer() {
    const statusEl = document.getElementById('status');
    const oppLabel = document.getElementById('opp-label');
    const wsUrl = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/mp/pong/' + encodeURIComponent(roomId);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => statusEl.textContent = 'Waiting for opponent…';
    ws.onclose = () => statusEl.textContent = 'Disconnected';
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'welcome') {
        statusEl.textContent = `${m.players.length} player${m.players.length === 1 ? '' : 's'} in room. Ready up!`;
      } else if (m.type === 'presence') {
        statusEl.textContent = `${m.players.length} player${m.players.length === 1 ? '' : 's'} in room. Need 2 to start.`;
      } else if (m.type === 'start') {
        mySide = m.side;
        oppLabel.textContent = mySide === 'left' ? 'Opponent (R)' : 'Opponent (L)';
        statusEl.textContent = 'Game started!';
        loop();
      } else if (m.type === 'state') {
        ball = m.ball;
        p1y = m.p1y;
        p2y = m.p2y;
        sp = m.p1s;
        sc = m.p2s;
        document.getElementById('sp').textContent = sp;
        document.getElementById('sc').textContent = sc;
        if (m.winner) {
          over = true;
          won = (m.winner === 'p1' && mySide === 'left') || (m.winner === 'p2' && mySide === 'right');
          drawOverlay(won ? 'You win! 🎉' : 'You lost.');
          if (won && onScore) onScore(sp * 100);
        }
      } else if (m.type === 'reset') {
        over = false; statusEl.textContent = 'Ready up to play again.';
      }
    };

    document.getElementById('rdy').onclick = () => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'ready', ready: true }));
    document.getElementById('rst').onclick = () => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'reset' }));

    function loop() {
      if (over) return;
      // Send paddle position
      if (ws.readyState === 1) {
        const myY = mouseTargetY - PAD_H / 2;
        ws.send(JSON.stringify({ type: 'move', y: Math.max(0, Math.min(H - PAD_H, myY)) }));
      }
      draw();
      requestAnimationFrame(loop);
    }
  }

  function draw() {
    ctx.fillStyle = '#05091a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let y = 0; y < H; y += 18) ctx.fillRect(W / 2 - 1, y, 2, 10);
    // Left Paddle
    ctx.fillStyle = (mySide === 'left' && !over) ? '#7c5cff' : '#24d1a1';
    ctx.fillRect(0, p1y, PAD_W, PAD_H);
    // Right Paddle
    ctx.fillStyle = (mySide === 'right' && !over) ? '#7c5cff' : '#24d1a1';
    ctx.fillRect(W - PAD_W, p2y, PAD_W, PAD_H);
    // Ball
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
  }

  function drawOverlay(text) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, H / 2);
  }
}
