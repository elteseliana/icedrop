/* =====================================================================
   ICE DROP — ANIMATIONS
   1) Page opens: frost crystals creep in from the edges of the screen,
      then melt away.
   2) Order confirmed: realistic 3D ice cubes fall from the top.
   Both are switched off if the device asks for "reduced motion".
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
     2) 3D ICE CUBES
     Each cube is a real 3D box: it rotates in space and is drawn as
     see-through glass with shiny edges and a highlight.
     ================================================================= */
  var VERTS = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  var FACES = [ // vertex indexes + outward normal
    { v: [0,1,2,3], n: [0,0,-1] }, { v: [5,4,7,6], n: [0,0,1] },
    { v: [4,0,3,7], n: [-1,0,0] }, { v: [1,5,6,2], n: [1,0,0] },
    { v: [4,5,1,0], n: [0,-1,0] }, { v: [3,2,6,7], n: [0,1,0] }
  ];
  var LIGHT = (function () { var l = [-0.45, -0.75, -0.5], m = Math.hypot(l[0], l[1], l[2]); return [l[0]/m, l[1]/m, l[2]/m]; })();

  function rotMatrix(a, b, c) {
    var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    return [
      cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc,
      cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc,
      -sb,     sa * cb,                ca * cb
    ];
  }
  function apply(m, v) {
    return [m[0]*v[0] + m[1]*v[1] + m[2]*v[2], m[3]*v[0] + m[4]*v[1] + m[5]*v[2], m[6]*v[0] + m[7]*v[1] + m[8]*v[2]];
  }

  function drawCube(g, c) {
    var m = rotMatrix(c.rx, c.ry, c.rz);
    var pts = VERTS.map(function (v) {
      var r = apply(m, v);
      var k = 1 / (1 + r[2] * 0.12);               // a little perspective
      return [c.x + r[0] * c.s * k, c.y + r[1] * c.s * k, r[2]];
    });
    var faces = FACES.map(function (f) {
      var n = apply(m, f.n);
      return { v: f.v, n: n, z: (pts[f.v[0]][2] + pts[f.v[1]][2] + pts[f.v[2]][2] + pts[f.v[3]][2]) / 4 };
    }).sort(function (a, b) { return b.z - a.z; }); // far faces first

    g.lineJoin = "round";
    g.lineCap = "round";
    // soft shadow behind the cube so it stands out on white
    g.save();
    g.shadowColor = "rgba(11,61,102,0.22)";
    g.shadowBlur = c.s * 0.8;
    g.shadowOffsetY = c.s * 0.35;
    g.beginPath();
    g.arc(c.x, c.y, c.s * 0.95, 0, Math.PI * 2);
    g.fillStyle = "rgba(160,212,240,0.12)";
    g.fill();
    g.restore();
    faces.forEach(function (f) {
      var front = f.n[2] < 0;
      var light = Math.max(0, -(f.n[0]*LIGHT[0] + f.n[1]*LIGHT[1] + f.n[2]*LIGHT[2]));
      var p = f.v.map(function (i) { return pts[i]; });
      var a = front ? 1 : 0.35;

      // glass body
      var grad = g.createLinearGradient(p[0][0], p[0][1], p[2][0], p[2][1]);
      grad.addColorStop(0, "rgba(235,248,255," + (0.35 + 0.45 * light) * a + ")");
      grad.addColorStop(0.55, "rgba(160,212,240," + (0.42 + 0.2 * light) * a + ")");
      grad.addColorStop(1, "rgba(92,164,214," + (0.5 + 0.15 * light) * a + ")");
      g.beginPath();
      g.moveTo(p[0][0], p[0][1]);
      for (var i = 1; i < 4; i++) g.lineTo(p[i][0], p[i][1]);
      g.closePath();
      g.fillStyle = grad;
      g.fill();

      if (!front) return;

      // thickness: a lighter inner panel
      var cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
      g.beginPath();
      for (var j = 0; j < 4; j++) {
        var ix = cx + (p[j][0] - cx) * 0.68, iy = cy + (p[j][1] - cy) * 0.68;
        if (j === 0) g.moveTo(ix, iy); else g.lineTo(ix, iy);
      }
      g.closePath();
      g.fillStyle = "rgba(255,255,255," + (0.06 + 0.16 * light) + ")";
      g.fill();
      g.strokeStyle = "rgba(255,255,255," + (0.15 + 0.25 * light) + ")";
      g.lineWidth = 0.8;
      g.stroke();

      // bright glass edges + a soft blue rim
      g.beginPath();
      g.moveTo(p[0][0], p[0][1]);
      for (var e = 1; e < 4; e++) g.lineTo(p[e][0], p[e][1]);
      g.closePath();
      g.strokeStyle = "rgba(40,115,170,0.55)";
      g.lineWidth = 2.2;
      g.stroke();
      g.strokeStyle = "rgba(255,255,255," + (0.55 + 0.4 * light) + ")";
      g.lineWidth = 1;
      g.stroke();

      // specular highlight streak on the faces that catch the light
      if (light > 0.55) {
        var h = (light - 0.55) * 2.2;
        g.beginPath();
        g.moveTo(p[0][0] + (p[1][0] - p[0][0]) * 0.18 + (p[3][0] - p[0][0]) * 0.16, p[0][1] + (p[1][1] - p[0][1]) * 0.18 + (p[3][1] - p[0][1]) * 0.16);
        g.lineTo(p[0][0] + (p[1][0] - p[0][0]) * 0.55 + (p[3][0] - p[0][0]) * 0.16, p[0][1] + (p[1][1] - p[0][1]) * 0.55 + (p[3][1] - p[0][1]) * 0.16);
        g.strokeStyle = "rgba(255,255,255," + Math.min(0.95, h) + ")";
        g.lineWidth = Math.max(1.5, c.s * 0.14);
        g.stroke();
      }
    });

    // tiny air bubbles trapped in the ice
    g.fillStyle = "rgba(255,255,255,0.7)";
    c.bubbles.forEach(function (b) {
      var r = apply(m, b);
      if (r[2] > 0.3) return;
      g.beginPath();
      g.arc(c.x + r[0] * c.s, c.y + r[1] * c.s, Math.max(0.8, c.s * 0.05), 0, Math.PI * 2);
      g.fill();
    });
  }

  var rainCanvas, rg, cubes = [], running = false, floorOpenAt = 0;

  function celebrate() {
    if (reducedMotion()) return;
    rainCanvas = rainCanvas || document.getElementById("ice-rain");
    if (!rainCanvas) return;
    rg = rainCanvas.getContext("2d");
    var W = window.innerWidth, H = window.innerHeight;
    rainCanvas.width = Math.round(W * DPR);
    rainCanvas.height = Math.round(H * DPR);
    rg.setTransform(DPR, 0, 0, DPR, 0, 0);

    var count = W < 600 ? 16 : 28;
    for (var i = 0; i < count; i++) {
      var s = rand(W < 600 ? 13 : 16, W < 600 ? 22 : 30);   // half the edge length, in px
      cubes.push({
        x: rand(s, W - s), y: rand(-H * 0.7, -s * 2),
        vx: rand(-0.6, 0.6), vy: rand(0, 2), s: s,
        rx: rand(0, 6.3), ry: rand(0, 6.3), rz: rand(0, 6.3),
        vrx: rand(-0.08, 0.08), vry: rand(-0.08, 0.08), vrz: rand(-0.05, 0.05),
        bubbles: [[rand(-0.6, 0.6), rand(-0.6, 0.6), -0.95], [rand(-0.6, 0.6), rand(-0.6, 0.6), -0.95]],
        opacity: 1
      });
    }
    floorOpenAt = performance.now() + 2600;
    rainCanvas.classList.add("on");
    if (running) return;
    running = true;
    var last = performance.now();
    (function tick(now) {
      var dt = Math.min(2, (now - last) / 16.67);
      last = now;
      var W2 = window.innerWidth, H2 = window.innerHeight, open = now > floorOpenAt;
      rg.clearRect(0, 0, W2, H2);
      for (var j = cubes.length - 1; j >= 0; j--) {
        var c = cubes[j];
        c.vy += 0.42 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.rx += c.vrx * dt; c.ry += c.vry * dt; c.rz += c.vrz * dt;
        var floor = H2 - c.s * 1.2;
        if (!open && c.y > floor) {                // bounce like a real cube: lose energy, wobble
          c.y = floor; c.vy *= -0.32; c.vx *= 0.7;
          c.vrx *= 0.6; c.vry *= 0.6; c.vrz = rand(-0.04, 0.04);
          if (Math.abs(c.vy) < 0.8) c.vy = 0;
        }
        if (open) c.opacity -= 0.025 * dt;
        if (c.y > H2 + 80 || c.opacity <= 0) { cubes.splice(j, 1); continue; }
        rg.globalAlpha = Math.max(0, c.opacity);
        drawCube(rg, c);
      }
      rg.globalAlpha = 1;
      if (cubes.length) requestAnimationFrame(tick);
      else { running = false; rg.clearRect(0, 0, W2, H2); rainCanvas.classList.remove("on"); }
    })(last);
  }

  window.IceDropFX = { frostIn: frostIn, celebrate: celebrate, reducedMotion: reducedMotion };
})();
