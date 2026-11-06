/* =====================================================================
   🧊 ICE DROP — ANIMATIONS
   1) Ice machine rains ice cubes when the page opens
   2) Skate-stop swoosh with a spray of snow in the hero
   3) Ice rain celebration after an order
   Everything turns off if the device asks for "reduced motion".
   ===================================================================== */
(function () {
  "use strict";

  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reducedMotion() { return !!(reduceQuery && reduceQuery.matches); }

  /* ---------- Draw one glossy cartoon ice cube onto a small canvas ----------
     We draw it once and then reuse the picture for every falling cube
     (this keeps phones fast).                                            */
  function makeCubeSprite(size) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var c = document.createElement("canvas");
    c.width = c.height = Math.ceil(size * dpr);
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    var s = size, r = s * 0.22, pad = s * 0.06, w = s - pad * 2;

    function roundRect(x, y, w, h, rr) {
      g.beginPath();
      g.moveTo(x + rr, y);
      g.arcTo(x + w, y, x + w, y + h, rr);
      g.arcTo(x + w, y + h, x, y + h, rr);
      g.arcTo(x, y + h, x, y, rr);
      g.arcTo(x, y, x + w, y, rr);
      g.closePath();
    }
    // body
    var grad = g.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, "rgba(255,255,255,0.98)");
    grad.addColorStop(0.45, "rgba(191,233,255,0.95)");
    grad.addColorStop(1, "rgba(63,169,245,0.95)");
    roundRect(pad, pad, w, w, r);
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = Math.max(1.5, s * 0.05);
    g.strokeStyle = "#2a8fd8";
    g.stroke();
    // inner "depth" face
    var inner = g.createLinearGradient(0, s, s, 0);
    inner.addColorStop(0, "rgba(30,136,229,0.35)");
    inner.addColorStop(1, "rgba(255,255,255,0)");
    roundRect(pad + w * 0.2, pad + w * 0.2, w * 0.68, w * 0.68, r * 0.7);
    g.fillStyle = inner;
    g.fill();
    // shiny highlights
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineCap = "round";
    g.lineWidth = s * 0.08;
    g.beginPath();
    g.moveTo(pad + w * 0.22, pad + w * 0.18);
    g.lineTo(pad + w * 0.55, pad + w * 0.14);
    g.stroke();
    g.beginPath();
    g.moveTo(pad + w * 0.14, pad + w * 0.32);
    g.lineTo(pad + w * 0.14, pad + w * 0.52);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(pad + w * 0.76, pad + w * 0.74, s * 0.05, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  /* ---------- Ice rain on a full-screen canvas ---------- */
  var canvas, ctx, sprites = [], cubes = [], rafId = null, running = false;
  var floorOpenAt = 0, doneCallbacks = [];

  function setupCanvas() {
    canvas = document.getElementById("ice-rain");
    if (!canvas) return false;
    ctx = canvas.getContext("2d");
    if (!sprites.length) {
      sprites = [makeCubeSprite(30), makeCubeSprite(40), makeCubeSprite(52)];
    }
    resize();
    return true;
  }
  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", function () { if (running) resize(); });

  /**
   * rain(options)
   *   fromX: where cubes come from (px from left) — null = whole width
   *   fromY: start height
   *   count: how many cubes
   *   duration: ms before the floor "opens" and cubes fall away
   *   onDone: called when the screen is clear
   */
  function rain(opts) {
    opts = opts || {};
    if (reducedMotion()) { if (opts.onDone) opts.onDone(); return; }
    if (!setupCanvas()) return;

    var W = window.innerWidth, H = window.innerHeight;
    var small = W < 600;
    var count = opts.count || (small ? 26 : 44);
    var spread = opts.fromX == null;
    floorOpenAt = Math.max(floorOpenAt, performance.now() + (opts.duration || 2600));
    if (opts.onDone) doneCallbacks.push(opts.onDone);

    for (var i = 0; i < count; i++) {
      var sp = sprites[(Math.random() * sprites.length) | 0];
      var size = sp.width / Math.min(window.devicePixelRatio || 1, 2);
      cubes.push({
        sprite: sp,
        size: size,
        x: spread ? Math.random() * W : opts.fromX + (Math.random() - 0.5) * 40,
        y: (opts.fromY || -60) - Math.random() * (spread ? H * 0.6 : 30),
        vx: spread ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 7,
        vy: Math.random() * 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
        delay: spread ? 0 : i * (1200 / count),  // machine "pours" cubes one after another
        born: false,
        opacity: 1
      });
    }

    canvas.classList.add("on");
    if (!running) {
      running = true;
      var last = performance.now();
      var tick = function (now) {
        var dt = Math.min(2, (now - last) / 16.67); // frame-rate independent
        last = now;
        var floorOpen = now > floorOpenAt;
        W = window.innerWidth; H = window.innerHeight;
        ctx.clearRect(0, 0, W, H);

        for (var j = cubes.length - 1; j >= 0; j--) {
          var c = cubes[j];
          if (c.delay > 0) { c.delay -= dt * 16.67; continue; }
          c.vy += 0.45 * dt;                // gravity
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.rot += c.vr * dt;
          var floor = H - c.size / 2;
          if (!floorOpen && c.y > floor) {   // bounce + tumble
            c.y = floor;
            c.vy *= -0.45;
            c.vx *= 0.8;
            c.vr = (Math.random() - 0.5) * 0.3;
            if (Math.abs(c.vy) < 1) c.vy = 0;
          }
          if (c.x < c.size / 2 || c.x > W - c.size / 2) { c.vx *= -0.7; c.x = Math.max(c.size / 2, Math.min(W - c.size / 2, c.x)); }
          if (floorOpen) c.opacity -= 0.02 * dt;
          if (c.y > H + 80 || c.opacity <= 0) { cubes.splice(j, 1); continue; }

          ctx.save();
          ctx.globalAlpha = Math.max(0, c.opacity);
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rot);
          ctx.drawImage(c.sprite, -c.size / 2, -c.size / 2, c.size, c.size);
          ctx.restore();
        }

        if (cubes.length) {
          rafId = requestAnimationFrame(tick);
        } else {
          running = false;
          ctx.clearRect(0, 0, W, H);
          canvas.classList.remove("on");
          var cbs = doneCallbacks; doneCallbacks = [];
          cbs.forEach(function (fn) { fn(); });
        }
      };
      rafId = requestAnimationFrame(tick);
    }
  }

  /* ---------- 1) Page load: the ice machine ---------- */
  function machineRain(onDone) {
    var machine = document.getElementById("ice-machine");
    if (reducedMotion() || !machine) { if (onDone) onDone(); return; }
    machine.classList.add("show");
    setTimeout(function () {
      var rect = machine.getBoundingClientRect();
      rain({
        fromX: rect.left + rect.width / 2,
        fromY: rect.bottom - 10,
        duration: 2600,
        onDone: onDone
      });
    }, 450);
    setTimeout(function () {
      machine.classList.remove("show");
      machine.classList.add("hide");
      setTimeout(function () { machine.style.display = "none"; }, 500);
    }, 2400);
  }

  /* ---------- 2) Skate-stop swoosh + snow spray ---------- */
  function skateStop() {
    var skate = document.querySelector(".skate");
    if (!skate) return;
    if (reducedMotion()) { skate.classList.add("done"); return; }
    skate.classList.add("run");
    // the cube stops sharply at ~85% of the 0.9s animation
    setTimeout(function () { spray(skate.querySelector(".skate-spray")); }, 760);
  }

  function spray(holder) {
    if (!holder || !holder.animate) return;
    var n = window.innerWidth < 600 ? 22 : 34;
    for (var i = 0; i < n; i++) {
      var bit = document.createElement("span");
      var shard = Math.random() < 0.4;
      var sz = shard ? 4 + Math.random() * 6 : 3 + Math.random() * 7;
      bit.className = "spray-bit" + (shard ? " shard" : "");
      bit.style.width = sz + "px";
      bit.style.height = (shard ? sz * 0.5 : sz) + "px";
      holder.appendChild(bit);
      // fan of snow thrown forward and up, like a hockey stop
      var angle = (-80 + Math.random() * 75) * Math.PI / 180;  // -80° .. -5°
      var dist = 40 + Math.random() * 110;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist;
      var rot = (Math.random() - 0.5) * 540;
      bit.animate([
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + dx + "px," + dy + "px) rotate(" + rot / 2 + "deg)", opacity: 1, offset: 0.55 },
        { transform: "translate(" + (dx * 1.2) + "px," + (dy * 0.4 + 40) + "px) rotate(" + rot + "deg)", opacity: 0 }
      ], {
        duration: 900 + Math.random() * 500,
        easing: "cubic-bezier(.15,.7,.3,1)",
        fill: "forwards"
      }).onfinish = (function (el) { return function () { el.remove(); }; })(bit);
    }
  }

  /* ---------- 3) Celebration ---------- */
  function celebrate() { rain({ fromX: null, duration: 2200 }); }

  window.IceDropFX = {
    machineRain: machineRain,
    skateStop: skateStop,
    celebrate: celebrate,
    reducedMotion: reducedMotion
  };
})();
