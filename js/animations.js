/* =====================================================================
   ICE DROP — ANIMATIONS
   1) Page opens: frost crystals creep in from the edges of the screen,
      then melt away.
   2) Order confirmed: realistic 3D ice cubes fall from the top.
   3) Top of the page: glossy ice cubes you can push around.
   4) Order form: a cooler that fills with ice as you choose more.
   All of it is switched off if the device asks for "reduced motion".
   ===================================================================== */
(function () {
  "use strict";

  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reducedMotion() { return !!(reduceQuery && reduceQuery.matches); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* =================================================================
     1) FROST
     Each "seed" on the screen edge grows a crystal: a main stem with
     side branches at 60° (like real ice crystals on a window).
     ================================================================= */
  function frostIn() {
    var wrap = document.getElementById("frost");
    var canvas = document.getElementById("frost-canvas");
    if (!wrap || !canvas || reducedMotion()) { if (wrap) wrap.remove(); return; }

    var W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    var g = canvas.getContext("2d");
    g.scale(DPR, DPR);

    var STEP = 5;                                 // px per growth step
    var SPEED = 0.12;                             // px per ms (lower = slower frost)
    var reach = Math.min(W, H) * (W < 600 ? 0.3 : 0.22);  // how far frost grows in
    var steps = [];                               // [x1,y1,x2,y2,time,depth]

    function grow(x, y, ang, len, depth, t) {
      var n = Math.max(1, Math.round(len / STEP));
      for (var i = 0; i < n; i++) {
        ang += rand(-0.1, 0.1);
        var nx = x + Math.cos(ang) * STEP, ny = y + Math.sin(ang) * STEP;
        t += STEP / SPEED;
        steps.push([x, y, nx, ny, t, depth]);
        if (depth < 3 && i % 2 === 1 && i < n - 2) {
          var left = Math.random() < 0.75, right = Math.random() < 0.75;
          var sideLen = len * 0.45 * (1 - i / n) + 3;
          if (left) grow(nx, ny, ang - Math.PI / 3, sideLen * rand(0.7, 1.1), depth + 1, t);
          if (right) grow(nx, ny, ang + Math.PI / 3, sideLen * rand(0.7, 1.1), depth + 1, t);
        }
        x = nx; y = ny;
      }
    }

    // seeds along all 4 edges (denser near the corners)
    function seedEdge(len, place) {
      var gap = W < 600 ? 46 : 62;
      for (var d = rand(0, gap); d < len; d += gap * rand(0.7, 1.3)) {
        var corner = Math.min(d, len - d) < len * 0.15 ? 1.35 : 1;
        place(d, reach * rand(0.45, 1) * corner, rand(0, 450));
      }
    }
    seedEdge(W, function (d, l, t) { grow(d, -2, Math.PI / 2 + rand(-0.6, 0.6), l, 0, t); });          // top
    seedEdge(W, function (d, l, t) { grow(d, H + 2, -Math.PI / 2 + rand(-0.6, 0.6), l, 0, t); });     // bottom
    seedEdge(H, function (d, l, t) { grow(-2, d, rand(-0.6, 0.6), l, 0, t); });                       // left
    seedEdge(H, function (d, l, t) { grow(W + 2, d, Math.PI + rand(-0.6, 0.6), l, 0, t); });          // right
    steps.sort(function (a, b) { return a[4] - b[4]; });
    // keep the whole growth under ~1.8 s, even on big screens
    var total = steps.length ? steps[steps.length - 1][4] : 0;
    if (total > 1800) steps.forEach(function (st) { st[4] *= 1800 / total; });

    var widths = [1.6, 1.1, 0.8, 0.55];
    var alphas = [0.9, 0.75, 0.6, 0.5];
    var cursor = 0, start = performance.now();

    g.lineCap = "round";
    g.shadowColor = "rgba(40, 120, 180, 0.35)";
    g.shadowBlur = 2;

    wrap.classList.add("on");

    function frame(now) {
      var elapsed = now - start;
      if (cursor < steps.length) {
        // draw all steps that are due, grouped by thickness
        var paths = [[], [], [], []];
        while (cursor < steps.length && steps[cursor][4] <= elapsed) {
          var s = steps[cursor++];
          paths[s[5]].push(s);
        }
        for (var d = 0; d < 4; d++) {
          if (!paths[d].length) continue;
          g.beginPath();
          for (var k = 0; k < paths[d].length; k++) {
            var p = paths[d][k];
            g.moveTo(p[0], p[1]);
            g.lineTo(p[2], p[3]);
          }
          // icy blue edge first, then a bright white core (reads on light pages)
          g.lineWidth = widths[d] + 1.6;
          g.strokeStyle = "rgba(70,150,205," + alphas[d] * 0.45 + ")";
          g.stroke();
          g.lineWidth = widths[d];
          g.strokeStyle = "rgba(255,255,255," + alphas[d] + ")";
          g.stroke();
        }
        requestAnimationFrame(frame);
      } else {
        // hold for a moment, then melt away
        setTimeout(function () {
          wrap.classList.add("melt");
          setTimeout(function () { wrap.remove(); }, 1100);
        }, 700);
      }
    }
    requestAnimationFrame(frame);
  }

  /* =================================================================
     ICE CUBE PICTURES
     Real ice cubes cut out of our photos (assets/img/cube-1/2/3.webp).
     Each cube spins and gently "tumbles" (squashes) so it looks 3D.
     ================================================================= */
  var SPRITES = ["assets/img/cube-1.webp", "assets/img/cube-2.webp", "assets/img/cube-3.webp"].map(function (src) {
    var im = new Image();
    im.src = src;
    return im;
  });
  function spritesReady() {
    return Promise.all(SPRITES.map(function (im) {
      return im.complete && im.naturalWidth ? Promise.resolve() : new Promise(function (ok) { im.onload = ok; im.onerror = ok; });
    }));
  }

  function newCube(x, y, s) {
    return {
      x: x, y: y, s: s,
      img: (Math.random() * SPRITES.length) | 0,
      flip: Math.random() < 0.5 ? -1 : 1,
      rx: rand(0, 6.3), ry: rand(0, 6.3), rz: rand(-0.6, 0.6),   // rx/ry = tumble, rz = spin
      opacity: 1
    };
  }

  // s = half the cube's width in px
  function drawCube(g, c, opts) {
    opts = opts || {};
    var im = SPRITES[c.img];
    if (!im || !im.naturalWidth) return;
    var w = c.s * 2.15, h = w * im.naturalHeight / im.naturalWidth;
    g.save();
    g.globalAlpha = (c.opacity == null ? 1 : c.opacity) * (opts.alpha || 1);
    if (opts.shadow) {
      g.save();
      g.fillStyle = "rgba(11,61,102,0.18)";
      g.filter = "blur(" + Math.max(2, Math.round(c.s * 0.2)) + "px)";
      g.beginPath();
      g.ellipse(c.x, c.y + h * 0.5, w * 0.42, w * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.translate(c.x, c.y);
    g.rotate(c.rz);
    g.scale(c.flip * (0.82 + 0.18 * Math.cos(c.rx)), 0.88 + 0.12 * Math.cos(c.ry));
    g.drawImage(im, -w / 2, -h / 2, w, h);
    g.restore();
  }

  function setupCanvas(canvas, w, h) {
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    var g = canvas.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return g;
  }

  /* =================================================================
     2) CELEBRATION: ice cubes fall from the top after an order
     ================================================================= */
  var rainCanvas, rg, rainCubes = [], raining = false, floorOpenAt = 0;

  function celebrate() {
    if (reducedMotion()) return;
    rainCanvas = rainCanvas || document.getElementById("ice-rain");
    if (!rainCanvas) return;
    var W = window.innerWidth, H = window.innerHeight;
    rg = setupCanvas(rainCanvas, W, H);
    var count = W < 600 ? 14 : 24;
    for (var i = 0; i < count; i++) {
      var s = rand(W < 600 ? 14 : 17, W < 600 ? 24 : 32);
      var c = newCube(rand(s, W - s), rand(-H * 0.7, -s * 2), s);
      c.vx = rand(-0.6, 0.6); c.vy = rand(0, 2);
      c.vrx = rand(-0.06, 0.06); c.vry = rand(-0.05, 0.05); c.vrz = rand(-0.06, 0.06);
      rainCubes.push(c);
    }
    floorOpenAt = performance.now() + 2600;
    rainCanvas.classList.add("on");
    if (raining) return;
    raining = true;
    var last = performance.now();
    (function tick(now) {
      var dt = Math.min(2, (now - last) / 16.67);
      last = now;
      var W2 = window.innerWidth, H2 = window.innerHeight, open = now > floorOpenAt;
      rg.clearRect(0, 0, W2, H2);
      for (var j = rainCubes.length - 1; j >= 0; j--) {
        var c = rainCubes[j];
        c.vy += 0.42 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.rx += c.vrx * dt; c.ry += c.vry * dt; c.rz += c.vrz * dt;
        var floor = H2 - c.s * 1.2;
        if (!open && c.y > floor) {
          c.y = floor; c.vy *= -0.32; c.vx *= 0.7;
          c.vrx *= 0.6; c.vry *= 0.6; c.vrz = rand(-0.04, 0.04);
          if (Math.abs(c.vy) < 0.8) c.vy = 0;
        }
        if (open) c.opacity -= 0.025 * dt;
        if (c.y > H2 + 80 || c.opacity <= 0) { rainCubes.splice(j, 1); continue; }
        drawCube(rg, c, { shadow: true });
      }
      if (rainCubes.length) requestAnimationFrame(tick);
      else { raining = false; rg.clearRect(0, 0, W2, H2); rainCanvas.classList.remove("on"); }
    })(last);
  }

  /* =================================================================
     3) ICE YOU CAN TOUCH (top of the page)
     Cubes float slowly; move your finger or mouse near them (or tap)
     and they get pushed away, spinning.
     ================================================================= */
  function touchIce(area, canvas) {
    // (fewer cubes on phones so the headline stays easy to read)
    if (!area || !canvas) return;
    var g, W, H, cubes = [], pointer = null, visible = true, running = false;

    function size() {
      W = area.clientWidth; H = area.clientHeight;
      g = setupCanvas(canvas, W, H);
    }
    size();
    var small = W < 700;
    var n = small ? 5 : 9;
    for (var i = 0; i < n; i++) {
      var s = small ? rand(15, 27) : rand(18, 36);
      var c = newCube(rand(s, W - s), rand(s, H - s), s);
      c.vx = rand(-0.25, 0.25); c.vy = rand(-0.25, 0.25);
      c.vrx = rand(-0.01, 0.01); c.vry = rand(-0.008, 0.008); c.vrz = rand(-0.004, 0.004);
      cubes.push(c);
    }

    function push(x, y, power) {
      cubes.forEach(function (c) {
        var dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy) || 1, R = 130;
        if (d < R) {
          var f = (1 - d / R) * power;
          c.vx += dx / d * f; c.vy += dy / d * f;
          c.vrx += rand(-0.04, 0.04) * f; c.vrz += rand(-0.03, 0.03) * f;
        }
      });
      kick();
    }
    function local(e) { var r = area.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    area.addEventListener("pointermove", function (e) { var p = local(e); push(p[0], p[1], 0.35); }, { passive: true });
    area.addEventListener("pointerdown", function (e) { var p = local(e); push(p[0], p[1], 4); }, { passive: true });

    function frame() {
      g.clearRect(0, 0, W, H);
      var moving = false;
      cubes.forEach(function (c) {
        c.x += c.vx; c.y += c.vy;
        c.rx += c.vrx; c.ry += c.vry; c.rz += c.vrz;
        c.vx *= 0.985; c.vy *= 0.985;
        c.vrx *= 0.99; c.vry *= 0.99; c.vrz *= 0.98;
        // keep a gentle drift forever
        if (Math.abs(c.vx) < 0.12) c.vx += rand(-0.02, 0.02);
        if (Math.abs(c.vy) < 0.12) c.vy += rand(-0.02, 0.02);
        if (Math.abs(c.vrx) < 0.004) c.vrx += 0.0005;
        if (c.x < c.s) { c.x = c.s; c.vx = Math.abs(c.vx) * 0.8; }
        if (c.x > W - c.s) { c.x = W - c.s; c.vx = -Math.abs(c.vx) * 0.8; }
        if (c.y < c.s) { c.y = c.s; c.vy = Math.abs(c.vy) * 0.8; }
        if (c.y > H - c.s) { c.y = H - c.s; c.vy = -Math.abs(c.vy) * 0.8; }
        drawCube(g, c, { alpha: 0.92 });
        moving = true;
      });
      if (visible && moving) requestAnimationFrame(frame); else running = false;
    }
    function kick() { if (!running && visible && !reducedMotion()) { running = true; requestAnimationFrame(frame); } }

    if (reducedMotion()) { spritesReady().then(frame); return; }   // still, no motion
    if ("IntersectionObserver" in window) {         // pause when scrolled away (saves battery)
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }).observe(area);
    }
    window.addEventListener("resize", function () { size(); kick(); });
    kick();
  }

  /* =================================================================
     4) THE COOLER THAT FILLS UP
     cooler.set(bags) → ice cubes drop into an open cooler.
     3 cubes per bag; a full cooler (20 bags) fills it to the top.
     ================================================================= */
  function cooler(canvas) {
    if (!canvas) return { set: function () {} };
    var g, W, H, geo, slots = [], settled = [], falling = [], cache = null, want = 0, running = false;
    var PER_BAG = 3, MAX = 60;

    function layout() {
      W = canvas.parentNode.clientWidth || 340; H = 210;
      g = setupCanvas(canvas, W, H);
      var cw = Math.min(W - 40, 320), x0 = (W - cw) / 2;
      geo = { x0: x0, x1: x0 + cw, cw: cw, rim: H - 70, back: H - 150, bottom: H - 8, lidTop: H - 196 };
      // resting places for cubes: rows from the front rim towards the back, then heaped
      slots = [];
      var cs = Math.max(9, Math.min(12, cw / 26));     // half-size of a cube
      var cols = Math.floor((cw - 30) / (cs * 2.3));
      var rows = Math.ceil(MAX / cols);
      for (var r = 0; r < rows; r++) {
        for (var k = 0; k < cols; k++) {
          var x = x0 + 18 + cs + k * ((cw - 36 - cs * 2) / Math.max(1, cols - 1)) + (r % 2 ? cs * 0.6 : 0) + rand(-2, 2);
          var y = geo.rim - cs * 0.6 - r * cs * 1.45 + rand(-2, 2);
          slots.push({ x: Math.min(x, geo.x1 - 18 - cs), y: y, s: cs * rand(0.9, 1.08) });
        }
      }
      slots = slots.slice(0, MAX);
      cache = null;
    }

    function drawBack() {
      var x0 = geo.x0, x1 = geo.x1;
      // open lid, tipped back
      var lid = g.createLinearGradient(0, geo.lidTop, 0, geo.back);
      lid.addColorStop(0, "#5bb3e6"); lid.addColorStop(1, "#1e7fc4");
      roundRect(x0 + 10, geo.lidTop, x1 - x0 - 20, geo.back - geo.lidTop + 6, 12);
      g.fillStyle = lid; g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(x0 + 22, geo.lidTop + 6, x1 - x0 - 44, 5, 3); g.fill();
      // inside of the cooler
      var inner = g.createLinearGradient(0, geo.back, 0, geo.rim);
      inner.addColorStop(0, "#c9d8e4"); inner.addColorStop(1, "#eef4f8");
      g.beginPath();
      g.moveTo(x0 + 14, geo.back); g.lineTo(x1 - 14, geo.back); g.lineTo(x1 - 4, geo.rim); g.lineTo(x0 + 4, geo.rim); g.closePath();
      g.fillStyle = inner; g.fill();
      g.strokeStyle = "#b9cbd9"; g.lineWidth = 2; g.stroke();
    }
    function drawFront() {
      var x0 = geo.x0, x1 = geo.x1;
      var body = g.createLinearGradient(0, geo.rim, 0, geo.bottom);
      body.addColorStop(0, "#ffffff"); body.addColorStop(1, "#dfe7ee");
      roundRect(x0, geo.rim - 6, x1 - x0, geo.bottom - geo.rim + 6, 14);
      g.fillStyle = body; g.fill();
      g.strokeStyle = "#cfdbe5"; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = "rgba(255,255,255,0.9)";
      roundRect(x0 + 8, geo.rim - 4, x1 - x0 - 16, 4, 2); g.fill();
      // handles
      g.fillStyle = "#9fb3c4";
      roundRect(x0 - 7, geo.rim + 14, 10, 22, 4); g.fill();
      roundRect(x1 - 3, geo.rim + 14, 10, 22, 4); g.fill();
      // name on the front
      g.fillStyle = "#1e90d6";
      g.font = "600 12px Montserrat, sans-serif";
      g.textAlign = "center";
      g.fillText("ICE DROP", (x0 + x1) / 2, geo.rim + 38);
    }
    function roundRect(x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }

    // settled cubes are drawn once into an off-screen picture (fast on phones)
    function rebuildCache() {
      cache = document.createElement("canvas");
      var cg = setupCanvas(cache, W, H);
      settled.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (c) { drawCube(cg, c); });
    }

    function render() {
      g.clearRect(0, 0, W, H);
      drawBack();
      if (!cache) rebuildCache();
      g.drawImage(cache, 0, 0, W, H);
      falling.slice().sort(function (a, b) { return a.ty - b.ty; }).forEach(function (c) { drawCube(g, c); });
      drawFront();
    }

    function tick() {
      var changed = false;
      for (var i = falling.length - 1; i >= 0; i--) {
        var c = falling[i];
        if (c.leaving) {                       // removed ice pops up and fades
          c.vy += 0.5; c.y += c.vy; c.opacity -= 0.06; c.rx += 0.1;
          if (c.opacity <= 0) { falling.splice(i, 1); }
          continue;
        }
        c.vy += 0.6; c.y += c.vy;
        c.rx += (c.trx - c.rx) * 0.12; c.ry += (c.try_ - c.ry) * 0.12; c.rz += (c.trz - c.rz) * 0.12;
        if (c.y >= c.ty) {
          c.y = c.ty;
          if (Math.abs(c.vy) > 2.5 && !c.bounced) { c.vy *= -0.3; c.bounced = true; }
          else { c.rx = c.trx; c.ry = c.try_; c.rz = c.trz; settled.push(c); falling.splice(i, 1); changed = true; }
        }
      }
      if (changed) cache = null;
      render();
      if (falling.length) requestAnimationFrame(tick); else running = false;
    }

    function set(bags, now) {
      if (!geo) layout();
      want = Math.min(MAX, Math.max(0, Math.round(bags * PER_BAG)));
      var have = settled.length + falling.filter(function (c) { return !c.leaving; }).length;
      var instant = now || reducedMotion();
      var delay = 0;
      while (have < want) {                    // add cubes
        var sl = slots[have];
        if (!sl) break;
        var c = newCube(sl.x, instant ? sl.y : -30 - delay, sl.s);
        c.ty = sl.y; c.vy = 0;
        c.trx = rand(-0.5, 0.5); c.try_ = rand(-0.4, 0.4); c.trz = rand(-0.35, 0.35);
        if (instant) { c.rx = c.trx; c.ry = c.try_; c.rz = c.trz; settled.push(c); }
        else falling.push(c);
        delay += 14;
        have++;
      }
      while (have > want) {                    // remove from the top
        var top = falling.filter(function (c) { return !c.leaving; });
        var c2 = top.length ? top[top.length - 1] : settled.pop();
        if (top.length) falling.splice(falling.indexOf(c2), 1);
        c2.leaving = true; c2.vy = -4; c2.opacity = 1;
        if (!instant) falling.push(c2);
        have--;
      }
      cache = null;
      if (instant) { falling = []; render(); return; }
      if (!running) { running = true; requestAnimationFrame(tick); }
    }

    // phones resize the screen while scrolling: only redo it if the width changed
    window.addEventListener("resize", function () {
      var nw = canvas.parentNode.clientWidth;
      if (!nw || nw === W) return;                 // hidden (e.g. on the thank-you screen) or same width
      settled = []; falling = []; layout(); set(want / PER_BAG, true);
    });
    layout();
    render();
    spritesReady().then(function () { cache = null; render(); });
    return { set: set };
  }

  window.IceDropFX = {
    frostIn: frostIn, celebrate: celebrate, touchIce: touchIce, cooler: cooler,
    drawCube: drawCube, spritesReady: spritesReady, reducedMotion: reducedMotion
  };
})();
