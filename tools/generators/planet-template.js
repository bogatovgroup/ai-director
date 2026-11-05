
// Планета в первом экране: вращающаяся Земля из точек (реальные материки, маска суши 1.5 градуса)
(function () {
  var cv = document.getElementById("planet");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2), S = 0, R = 0, K = 1;
  var MW = 240, MH = 120, MASK = "__MASK__";

  // распаковка битовой маски суши
  var raw = atob(MASK), bits = new Uint8Array(MW * MH), i, b;
  for (i = 0; i < raw.length; i++) { var v = raw.charCodeAt(i); for (b = 0; b < 8; b++) bits[i * 8 + b] = (v >> (7 - b)) & 1; }

  // точки только на суше (спираль Фибоначчи)
  var N = 30000, GA = Math.PI * (3 - Math.sqrt(5)), px = [], py = [], pz = [];
  for (i = 0; i < N; i++) {
    var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * GA;
    var x = Math.sin(th) * r, z = Math.cos(th) * r;
    var lon = Math.atan2(x, z), lat = Math.asin(y);
    var col = Math.min(MW - 1, Math.floor((lon + Math.PI) / (2 * Math.PI) * MW)), row = Math.min(MH - 1, Math.floor((Math.PI / 2 - lat) / Math.PI * MH));
    if (bits[row * MW + col]) { px.push(x); py.push(y); pz.push(z); }
  }
  var M = px.length, LV = 9, buckets = [], bc = [];
  for (i = 0; i < LV; i++) { buckets.push(new Float32Array(M * 2)); bc.push(0); }

  var stars = [], seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (i = 0; i < 14; i++) stars.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, ph: rnd() * 6.28 });

  var TILT = 0.38, cT = Math.cos(TILT), sT = Math.sin(TILT);
  var LX = 0.55, LY = 0.5, LZ = 0.67, ln = Math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= ln; LY /= ln; LZ /= ln;

  function resize() {
    S = cv.clientWidth || 400; cv.width = cv.height = Math.round(S * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); R = S * 0.4; K = S / 520;
  }

  function frame(time) {
    var ang = 0.5 + time * 0.00012, c = Math.cos(ang), s = Math.sin(ang), cx = S / 2, cy = S / 2, k;
    ctx.clearRect(0, 0, S, S);
    for (k = 0; k < stars.length; k++) {
      var st = stars[k], tw = 0.15 + 0.2 * Math.sin(time * 0.0012 + st.ph);
      ctx.fillStyle = "rgba(220,215,255," + tw + ")"; ctx.fillRect(cx + st.x * S * 0.48, cy + st.y * S * 0.48, 1.2 * K + 0.3, 1.2 * K + 0.3);
    }
    for (k = 0; k < LV; k++) bc[k] = 0;
    for (i = 0; i < M; i++) {
      var x = px[i], yy = py[i], z = pz[i];
      var x1 = x * c + z * s, z1 = -x * s + z * c;
      var y2 = yy * cT - z1 * sT, z2 = yy * sT + z1 * cT;
      if (z2 <= 0) continue;
      var lam = x1 * LX + y2 * LY + z2 * LZ; if (lam < 0) lam = 0;
      var rim = Math.pow(1 - z2, 2.4);
      var lv = 0.1 + 0.45 * lam + 1.0 * rim; if (lv > 1) lv = 1;
      var q = Math.floor(lv * (LV - 1) + 0.5), a = buckets[q], n = bc[q];
      a[n] = cx + x1 * R; a[n + 1] = cy - y2 * R; bc[q] = n + 2;
    }
    var d = 1.35 * K + 0.25;
    for (k = 0; k < LV; k++) {
      var t = k / (LV - 1), arr = buckets[k], cnt = bc[k], j;
      ctx.fillStyle = "rgba(" + Math.round(205 + 50 * t) + "," + Math.round(198 + 57 * t) + ",255," + (0.12 + 0.88 * t) + ")";
      for (j = 0; j < cnt; j += 2) ctx.fillRect(arr[j] - d / 2, arr[j + 1] - d / 2, d, d);
    }
    // лёгкая атмосфера по краю
    var rg = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.07);
    rg.addColorStop(0, "rgba(180,165,255,0)"); rg.addColorStop(0.55, "rgba(180,165,255,.13)"); rg.addColorStop(1, "rgba(180,165,255,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.07, 0, 6.283); ctx.fill();
  }

  var running = false, visible = true;
  function loop(t) { if (!running) return; frame(t); requestAnimationFrame(loop); }
  function start() { if (reduce || running || !visible || document.hidden) return; running = true; requestAnimationFrame(loop); }
  function stop() { running = false; }
  window.addEventListener("resize", function () { resize(); if (!running) frame(performance.now()); });
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(cv);
  resize(); frame(0); start();
})();
