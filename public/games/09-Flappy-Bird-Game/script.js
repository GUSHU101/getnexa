// Flappy Bird — self-contained canvas remake (no external assets).
// Controls: tap / click / Space / ArrowUp to flap.
(function () {
  "use strict";
  var canvas = document.getElementById("myCanvas");
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;

  var GRAVITY = 0.45;
  var FLAP = -7.5;
  var PIPE_W = 64;
  var GAP = 150;
  var PIPE_SPACING = 220;
  var SPEED = 2.4;
  var GROUND_H = H * 0.30; // matches the sand band in the CSS gradient

  var bird, pipes, score, best, state; // state: "ready" | "play" | "over"
  best = Number(localStorage.getItem("flappy_best") || 0);

  function reset() {
    bird = { x: W * 0.28, y: H * 0.45, v: 0, r: 14 };
    pipes = [];
    score = 0;
    state = "ready";
    spawnPipe(W + 80);
    spawnPipe(W + 80 + PIPE_SPACING);
    spawnPipe(W + 80 + PIPE_SPACING * 2);
  }

  function spawnPipe(x) {
    var minTop = 50;
    var maxTop = H - GROUND_H - GAP - 50;
    var top = minTop + Math.random() * (maxTop - minTop);
    pipes.push({ x: x, top: top, scored: false });
  }

  function flap() {
    if (state === "over") { reset(); return; }
    if (state === "ready") state = "play";
    bird.v = FLAP;
  }

  function update() {
    if (state !== "play") return;
    bird.v += GRAVITY;
    bird.y += bird.v;

    for (var i = 0; i < pipes.length; i++) {
      var p = pipes[i];
      p.x -= SPEED;
      if (!p.scored && p.x + PIPE_W < bird.x) {
        p.scored = true;
        score++;
        if (score > best) { best = score; localStorage.setItem("flappy_best", String(best)); }
      }
    }
    // recycle pipes
    if (pipes.length && pipes[0].x + PIPE_W < 0) {
      pipes.shift();
      spawnPipe(pipes[pipes.length - 1].x + PIPE_SPACING);
    }

    // collisions
    var floorY = H - GROUND_H;
    if (bird.y + bird.r >= floorY || bird.y - bird.r <= 0) { gameOver(); return; }
    for (var j = 0; j < pipes.length; j++) {
      var q = pipes[j];
      if (bird.x + bird.r > q.x && bird.x - bird.r < q.x + PIPE_W) {
        if (bird.y - bird.r < q.top || bird.y + bird.r > q.top + GAP) { gameOver(); return; }
      }
    }
  }

  function gameOver() { state = "over"; }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    var tilt = Math.max(-0.5, Math.min(1.2, bird.v / 12));
    ctx.rotate(tilt);
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb020";
    ctx.beginPath();
    ctx.ellipse(-3, 3, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(6, -5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.arc(7, -5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff7a45";
    ctx.beginPath();
    ctx.moveTo(bird.r - 2, -2); ctx.lineTo(bird.r + 7, 0); ctx.lineTo(bird.r - 2, 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPipe(p) {
    var floorY = H - GROUND_H;
    ctx.fillStyle = "#3ec46d";
    ctx.strokeStyle = "#2a8f4e";
    ctx.lineWidth = 3;
    ctx.fillRect(p.x, 0, PIPE_W, p.top);
    ctx.strokeRect(p.x, 0, PIPE_W, p.top);
    ctx.fillRect(p.x - 4, p.top - 18, PIPE_W + 8, 18);
    ctx.strokeRect(p.x - 4, p.top - 18, PIPE_W + 8, 18);
    var by = p.top + GAP;
    ctx.fillRect(p.x, by, PIPE_W, floorY - by);
    ctx.strokeRect(p.x, by, PIPE_W, floorY - by);
    ctx.fillRect(p.x - 4, by, PIPE_W + 8, 18);
    ctx.strokeRect(p.x - 4, by, PIPE_W + 8, 18);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var floorY = H - GROUND_H;
    for (var i = 0; i < pipes.length; i++) drawPipe(pipes[i]);
    ctx.fillStyle = "#c9c47e";
    ctx.fillRect(0, floorY, W, 6);

    drawBird();

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 4;
    ctx.font = "bold 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText(String(score), W / 2, 70);
    ctx.fillText(String(score), W / 2, 70);

    if (state === "ready") {
      banner("Tap to Start", "Best: " + best);
    } else if (state === "over") {
      banner("Game Over", "Score " + score + "  •  Best " + best + "  •  Tap to retry");
    }
  }

  function banner(title, sub) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, H * 0.32, W, 120);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillText(title, W / 2, H * 0.32 + 50);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(sub, W / 2, H * 0.32 + 86);
  }

  function frame() {
    update();
    draw();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("mousedown", function (e) { e.preventDefault(); flap(); });
  canvas.addEventListener("touchstart", function (e) { e.preventDefault(); flap(); }, { passive: false });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.key === " " || e.key === "ArrowUp") { e.preventDefault(); flap(); }
  });

  reset();
  requestAnimationFrame(frame);
})();
