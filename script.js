// Приём заявок. Если задан вебхук Битрикс24 (crm.lead.add) - заявка уходит в CRM,
// иначе открывается письмо на info@ai-corp.by (mailto). Секреты в публичный репозиторий не коммитить.
const BITRIX_WEBHOOK = "";
const MAIL = "info@ai-corp.by";

const who = document.getElementById("who"), company = document.getElementById("company");
who.addEventListener("change", () => { const c = who.value === "компанию"; company.style.display = c ? "" : "none"; company.required = c; });

document.querySelector("form.lead-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, m = f.querySelector(".msg"), d = Object.fromEntries(new FormData(f)), q = new URLSearchParams(location.search);
  const text = ["Имя: " + d.name, "Email: " + d.email, "Контакт: " + d.contact, "Формат: " + d.format,
    "Заявка для: " + d.who + (d.company ? " (" + d.company + ")" : ""), "Комментарий: " + (d.comment || "-"),
    "Согласие на обработку ПДн: да (" + new Date().toISOString() + ", согласие ред. 1.0 от 19.10.2026)",
    "Согласие на рассылки: " + (d.mailing ? "да" : "нет")].join("\n");
  if (!BITRIX_WEBHOOK) {
    location.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent("Заявка: Директор по внедрению ИИ") + "&body=" + encodeURIComponent(text);
    m.textContent = "Открылось письмо в вашей почтовой программе - отправьте его. Если не открылось, напишите на " + MAIL + ".";
    return;
  }
  const fields = { TITLE: "Заявка с сайта: Директор по внедрению ИИ", NAME: d.name, EMAIL: [{ VALUE: d.email, VALUE_TYPE: "WORK" }],
    COMMENTS: text + "\nСтраница: " + location.href, SOURCE_ID: "WEB", UTM_SOURCE: q.get("utm_source") || "",
    UTM_MEDIUM: q.get("utm_medium") || "", UTM_CAMPAIGN: q.get("utm_campaign") || "" };
  try {
    const r = await fetch(BITRIX_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
    if (!r.ok) throw 0; m.textContent = "Спасибо! Мы скоро свяжемся с вами."; f.reset();
  } catch { m.textContent = "Ошибка отправки. Напишите нам на " + MAIL + "."; }
});

// Чек-лист: считается на клиенте, ничего не сохраняется и не отправляется
const verdict = document.getElementById("verdict"), quiz = document.getElementById("quiz");
quiz.addEventListener("change", () => {
  const ans = [0, 1, 2, 3, 4].map(i => quiz.querySelector("input[name=q" + i + "]:checked"));
  if (ans.some(a => !a)) { verdict.style.display = "none"; return; }
  const n = ans.filter(a => a.value === "1").length;
  verdict.innerHTML = n <= 1 ? "<strong>0-1 «да» - доработка.</strong> Опишите, какие данные нужно подготовить, и повторите оценку."
    : n <= 3 ? "<strong>2-3 «да» - условный допуск.</strong> Запишите условия: что сделать, кто отвечает, к какому сроку. Условный допуск без записанных условий, ответственных и сроков не является условным допуском."
    : "<strong>4-5 «да» - предварительный допуск по данным.</strong> Это не разрешение на запуск проекта: право использования данных, безопасность и экономика проверяются отдельно.";
  verdict.style.display = "block";
});

// Баннер cookies: аналитика подключается только после согласия
function loadAnalytics() { /* сюда добавить код счётчика (Метрика и т.п.) после выбора сервиса */ }
(function () {
  var KEY = "aicorp_cookie", b = document.getElementById("cookie"), v = null;
  try { v = localStorage.getItem(KEY); } catch (e) {}
  if (v === "all") { loadAnalytics(); return; }
  if (v || !b) return;
  b.style.display = "flex";
  b.querySelectorAll("[data-c]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var c = btn.getAttribute("data-c");
      try { localStorage.setItem(KEY, c); } catch (e) {}
      b.style.display = "none";
      if (c === "all") loadAnalytics();
    });
  });
})();

// Спикеры: стрелки прокрутки
(function () {
  var sc = document.getElementById("sp");
  if (!sc) return;
  document.querySelectorAll("[data-sc]").forEach(function (b) {
    b.addEventListener("click", function () { sc.scrollBy({ left: Number(b.getAttribute("data-sc")) * 380, behavior: "smooth" }); });
  });
})();

// Вакансии HeadHunter: пока заглушка.
// Позже: запрос на свой серверный прокси к https://api.hh.ru/vacancies?text=... (нужен заголовок User-Agent и токен приложения),
// ответ кэшировать на сервере, на странице выводить карточки: название, компания, зарплата, ссылка на вакансию.
function loadVacancies() { /* TODO: fetch("/api/vacancies") и отрисовка в #hh-vacancies */ }

// Карточки спикеров: переворот по клику / Enter / пробелу
document.addEventListener("click", function (e) { var c = e.target.closest(".flip"); if (c) c.classList.toggle("is-flipped"); });
document.addEventListener("keydown", function (e) {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("flip")) { e.preventDefault(); e.target.classList.toggle("is-flipped"); }
});

// Планета в первом экране: канвас, точечный глобус с материками, сеткой, атмосферой, орбитами и «сетью» дуг
(function () {
  var cv = document.getElementById("planet");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2), S = 0, R = 0, K = 1;

  function hash(x, y, z) { var n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
  function sm(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function vnoise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    return lerp(
      lerp(lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf), lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf), yf),
      lerp(lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf), lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  }
  function fbm(x, y, z) { return vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15; }

  // точки на сфере (спираль Фибоначчи)
  var N = 3400, pts = [], lands = [], GA = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < N; i++) {
    var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * GA;
    var x = Math.cos(th) * r, z = Math.sin(th) * r, l = fbm(x * 2.2 + 3, y * 2.2, z * 2.2);
    var p = { x: x, y: y, z: z, l: l, land: l > 0.52 };
    pts.push(p); if (p.land && l > 0.58) lands.push(p);
  }
  // дуги связей между точками суши
  var arcs = [], seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (var a = 0; a < 7; a++) arcs.push({ A: lands[Math.floor(rnd() * lands.length)], B: lands[Math.floor(rnd() * lands.length)], off: rnd() });
  // звёзды
  var stars = [];
  for (var s = 0; s < 70; s++) stars.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, r: 0.4 + rnd() * 1.2, ph: rnd() * 6.28 });

  var TILT = 0.42, cT = Math.cos(TILT), sT = Math.sin(TILT);
  function rot(x, y, z, ang) {
    var c = Math.cos(ang), s = Math.sin(ang), x1 = x * c + z * s, z1 = -x * s + z * c;
    return { x: x1, y: y * cT - z1 * sT, z: y * sT + z1 * cT };
  }
  var LX = -0.5, LY = 0.55, LZ = 0.67;

  function resize() {
    S = cv.clientWidth || 400; cv.width = cv.height = Math.round(S * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); R = S * 0.3; K = R / 150;
  }

  // орбита: кольцо в наклонной плоскости
  function ringPoint(phi, rad, tiltX, tiltZ) {
    var x = Math.cos(phi) * rad, y = 0, z = Math.sin(phi) * rad;
    var y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX), z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
    return { x: x * Math.cos(tiltZ) - y1 * Math.sin(tiltZ), y: x * Math.sin(tiltZ) + y1 * Math.cos(tiltZ), z: z1 };
  }
  function drawRing(cx, cy, rad, tx, tz, front, alpha, t, sats) {
    var seg = 120, i, prev = null;
    ctx.lineWidth = 1.1 * K;
    for (i = 0; i <= seg; i++) {
      var ph = i / seg * Math.PI * 2, q = ringPoint(ph, rad, tx, tz), vis = front ? q.z >= 0 : q.z < 0;
      var X = cx + q.x * R, Y = cy - q.y * R;
      if (prev && vis && prev.vis) {
        ctx.strokeStyle = "rgba(196,181,253," + (alpha * (0.5 + 0.5 * Math.abs(q.z))) + ")";
        ctx.beginPath(); ctx.moveTo(prev.X, prev.Y); ctx.lineTo(X, Y); ctx.stroke();
      }
      prev = { X: X, Y: Y, vis: vis };
    }
    for (i = 0; i < sats.length; i++) {
      var sp = ringPoint(t * sats[i].v + sats[i].p, rad, tx, tz);
      if ((front && sp.z >= 0) || (!front && sp.z < 0)) {
        var gx = cx + sp.x * R, gy = cy - sp.y * R, g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 9 * K);
        g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.25, "rgba(196,181,253,.8)"); g.addColorStop(1, "rgba(124,58,237,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, 9 * K, 0, 6.283); ctx.fill();
      }
    }
  }
  var satsA = [{ v: 0.00055, p: 0 }, { v: 0.00055, p: 3.4 }], satsB = [{ v: -0.0004, p: 1.2 }];

  function frame(time) {
    var ang = 0.8 + time * 0.00016, cx = S / 2, cy = S / 2, i, p, q;
    ctx.clearRect(0, 0, S, S);

    // звёзды
    for (i = 0; i < stars.length; i++) {
      var st = stars[i], tw = 0.35 + 0.35 * Math.sin(time * 0.0015 + st.ph);
      ctx.fillStyle = "rgba(196,181,253," + tw + ")";
      ctx.beginPath(); ctx.arc(cx + st.x * S * 0.5, cy + st.y * S * 0.5, st.r * K * 0.8, 0, 6.283); ctx.fill();
    }
    // внешнее свечение
    var glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 2.0);
    glow.addColorStop(0, "rgba(124,58,237,.42)"); glow.addColorStop(0.45, "rgba(124,58,237,.14)"); glow.addColorStop(1, "rgba(124,58,237,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 2.0, 0, 6.283); ctx.fill();

    // орбиты: задняя половина
    drawRing(cx, cy, 1.55, 1.15, -0.35, false, 0.28, time, satsA);
    drawRing(cx, cy, 1.9, 0.85, 0.5, false, 0.16, time, satsB);

    // тело планеты
    var body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, "#3a1a78"); body.addColorStop(0.55, "#170a35"); body.addColorStop(1, "#060110");
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();

    // сетка широт и долгот
    ctx.lineWidth = 0.7 * K;
    var la, lo, j;
    for (la = -60; la <= 60; la += 30) {
      var yy = Math.sin(la * Math.PI / 180), rr = Math.cos(la * Math.PI / 180), prevG = null;
      for (j = 0; j <= 72; j++) {
        var th2 = j / 72 * 6.283; q = rot(Math.cos(th2) * rr, yy, Math.sin(th2) * rr, ang);
        if (prevG && q.z > 0 && prevG.z > 0) { ctx.strokeStyle = "rgba(167,139,250,.16)"; ctx.beginPath(); ctx.moveTo(cx + prevG.x * R, cy - prevG.y * R); ctx.lineTo(cx + q.x * R, cy - q.y * R); ctx.stroke(); }
        prevG = q;
      }
    }
    for (lo = 0; lo < 180; lo += 30) {
      var prevL = null;
      for (j = 0; j <= 72; j++) {
        var ph2 = j / 72 * 6.283, xl = Math.cos(ph2) * Math.cos(lo * Math.PI / 180), zl = Math.cos(ph2) * Math.sin(lo * Math.PI / 180), yl = Math.sin(ph2);
        q = rot(xl, yl, zl, ang);
        if (prevL && q.z > 0 && prevL.z > 0) { ctx.strokeStyle = "rgba(167,139,250,.13)"; ctx.beginPath(); ctx.moveTo(cx + prevL.x * R, cy - prevL.y * R); ctx.lineTo(cx + q.x * R, cy - q.y * R); ctx.stroke(); }
        prevL = q;
      }
    }

    // точки: сначала дальняя сторона (тусклая), затем ближняя
    for (i = 0; i < pts.length; i++) {
      p = pts[i]; q = rot(p.x, p.y, p.z, ang);
      if (q.z >= 0) continue;
      ctx.fillStyle = p.land ? "rgba(139,110,230,.16)" : "rgba(139,110,230,.05)";
      ctx.fillRect(cx + q.x * R - 0.5 * K, cy - q.y * R - 0.5 * K, K, K);
    }
    for (i = 0; i < pts.length; i++) {
      p = pts[i]; q = rot(p.x, p.y, p.z, ang);
      if (q.z < 0) continue;
      var lam = Math.max(0, q.x * LX + q.y * LY + q.z * LZ), rim = Math.pow(1 - q.z, 1.6), px = cx + q.x * R, py = cy - q.y * R;
      if (p.land) {
        var sz = (0.9 + 1.3 * (0.35 + 0.65 * lam) + (p.l - 0.52) * 3) * K * (0.7 + 0.4 * q.z);
        ctx.fillStyle = "rgba(" + Math.round(150 + 90 * lam) + "," + Math.round(120 + 90 * lam) + ",255," + (0.35 + 0.6 * lam + 0.2 * rim) + ")";
        ctx.beginPath(); ctx.arc(px, py, sz * 0.8, 0, 6.283); ctx.fill();
      } else {
        ctx.fillStyle = "rgba(124,90,230," + (0.12 + 0.3 * lam) + ")";
        ctx.fillRect(px - 0.45 * K, py - 0.45 * K, 0.9 * K, 0.9 * K);
      }
    }

    // дуги-«сеть» с бегущими импульсами
    for (i = 0; i < arcs.length; i++) {
      var A = arcs[i].A, B = arcs[i].B, dot = A.x * B.x + A.y * B.y + A.z * B.z, om = Math.acos(Math.max(-1, Math.min(1, dot))), sin = Math.sin(om) || 1;
      if (om < 0.5) continue;
      var pulse = (time * 0.00022 + arcs[i].off) % 1, prevA = null, k;
      for (k = 0; k <= 36; k++) {
        var t = k / 36, w1 = Math.sin((1 - t) * om) / sin, w2 = Math.sin(t * om) / sin, lift = 1 + 0.22 * Math.sin(Math.PI * t) * Math.min(1, om / 1.6);
        q = rot((A.x * w1 + B.x * w2) * lift, (A.y * w1 + B.y * w2) * lift, (A.z * w1 + B.z * w2) * lift, ang);
        if (prevA && q.z > 0.02 && prevA.z > 0.02) {
          var near = Math.max(0, 1 - Math.abs(t - pulse) * 6);
          ctx.strokeStyle = "rgba(196,181,253," + (0.22 + 0.7 * near) + ")"; ctx.lineWidth = (0.8 + 1.4 * near) * K;
          ctx.beginPath(); ctx.moveTo(cx + prevA.x * R, cy - prevA.y * R); ctx.lineTo(cx + q.x * R, cy - q.y * R); ctx.stroke();
        }
        prevA = q;
      }
    }

    // атмосфера: подсветка по краю и блик
    var rimG = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.12);
    rimG.addColorStop(0, "rgba(167,139,250,0)"); rimG.addColorStop(0.62, "rgba(167,139,250,.38)"); rimG.addColorStop(0.8, "rgba(124,58,237,.18)"); rimG.addColorStop(1, "rgba(124,58,237,0)");
    ctx.fillStyle = rimG; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 6.283); ctx.fill();
    var spec = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.45, cy - R * 0.5, R * 0.7);
    spec.addColorStop(0, "rgba(255,255,255,.16)"); spec.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();

    // орбиты: передняя половина
    drawRing(cx, cy, 1.55, 1.15, -0.35, true, 0.7, time, satsA);
    drawRing(cx, cy, 1.9, 0.85, 0.5, true, 0.4, time, satsB);
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
