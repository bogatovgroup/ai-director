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

// Планета в первом экране: вращающаяся Земля из точек (реальные материки, маска суши 1.5 градуса)
(function () {
  var cv = document.getElementById("planet");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2), S = 0, R = 0, K = 1;
  var MW = 240, MH = 120, MASK = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//AAf/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//8////74AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf//v/////AAAC/AAYAAAAfAAAAAAAAAAAAAAAAGOz/9/////+AAAPgAAAAAAAAcAAAAAAAAAAAAAADAAY/w//////AAACAAAAAAAAAeAAAAAAAAAAAAAAA/3r/AAH///+AAAAAAAAPgAA//8AAfwAAAAAAAAAfAAEAAAD///8AAAAAAAA4AAD//wAAAAAAAAAAAAA/+34/IAB///4AAAAAAABgDB/////wHgAAAwAGAAAB/wc//gA///4AAAADgABwPf/////z/+IABAB//4/8///GH4Bv//wAAAA/8AADPf/////////9+wH/////i4/uF8A//8AAAAD//5n//v///////////7D////////8B/g//gAQAAH/87///////////////OH////////8P4Af4AP4AAfz+H///////////////Bg////////Ng+Af4ADAAB/v////////////////+AH///////8CuAAHwAAAAH/P////////////////4AD/7/////4APwABgAAAAH/P//////////////y/AAA/AH////4APzAAAAAAADfH////////////+BjgAAAFgAf///8AP/gAAAAAOAuL////////////4APgAAAwAAP////wH/gAAAAAOBuP////////////wAPgAACAAAH////+f/8AAAAA3Bh/////////////gAeAAAAAAAT////+f/+AAAAA3H///////////////AOAAAAAAAD/////f/8AAAAAPv///////////////AIAAAAAAAD//////8WAAAAAMf//////////////9AAAAAAAAAAf/////+PgAAAAH///////////////6AAAAAAAAAAf/////+SgAAAAD////v//////////yAAAAAAAAAAf//////wAAAAAB///zfx/////////iAAAAAAAAAAf/////yAAAAAAB/z/gPj/////////DgAAAAAAAAAf/////gAAAAAA/wc/AHx////////4HAAAAAAAAAAf/////AAAAAAA/hHf//4////////wEAAAAAAAAAAf////+AAAAAAB/BCZ//5///////1gGAAAAAAAAAAP////8AAAAAAA/AON//4///////hwEAAAAAAAAAAH////4AAAAAAAOfgA//////////4wcAAAAAAAAAAH////4AAAAAAAP/gCG/////////gz8AAAAAAAAAAB////gAAAAAAAf/gAB/////////wHgAAAAAAAAAAA////AAAAAAAB//8eB/////////4EAAAAAAAAAAAAn///AAAAAAAB///f//////////4AAAAAAAAAAAAAX/5DAAAAAAAB//////z///////4AAAAAAAAAAAAAb/gBAAAAAAAH////+/5///////4AAAAAAAAAAAAAF/gBoAAAAAAP////+/4f//////wAAAAAAAAAAAAAE/gAQAAAAAAP////+f8wH/////oAAAAAAAAAAAAACfgDAAAAAAAf/////P/4D/////IAAAAAAAAIAAAAAPgQYAAAAAA//////v/8D/+f/4AAAAAAAAACAAAAAfxwMgAAAAAf/////n/4A/8P+QAAAAAAAAAAAAAAAP/gL0AAAAAf/////n/wA/wP+wIAAAAAAAAAAAAAAB/gAAAAAAAf/////z/gAfgH+AMAAAAAAAAAAAAAAAT8AAAAAAAf/////7+AAeAF/AIAAAAAAAAAAAAAAAB8AAAAAAAf//////wAAeAB/gMAAAAAAAAAAAAAAAAMAAAAAAAf//////AAAOAB/gKAAAAAAAAAAAAAAAAMD4AAAAAP/////+cAAOAAPAWAAAAAAAAAAAAAAAAGX/gAAAAH//////8AAHABCAFAAAAAAAAAAAAAAAADf/4AAAAH//////4AAFABgAHAAAAAAAAAAAAAAAAAP/4AAAAD//////4AABAAwBBAAAAAAAAAAAAAAAAAP//gAAAB+H////wAAAAGYDgAAAAAAAAAAAAAAAAAP//wAAAAAA////gAAAADYHAAAAAAAAAAAAAAAAAAf//wAAAAAA////AAAAAB4PgAAAAAAAAAAAAAAAAA///wAAAAAA///+AAAAAA4/OQAAAAAAAAAAAAAAAA///+AAAAAA///8AAAAAAcfUWAAAAAAAAAAAAAAAAf///AAAAAA///4AAAAAAcfYDcCAAAAAAAAAAAAAA////+AAAAAf//wAAAAAAOCEj/BAAAAAAAAAAAAAA/////gAAAAP//wAAAAAAGAUBPmAAAAAAAAAAAAAA/////gAAAAP//wAAAAAAD4AAPwYAAAAAAAAAAAAAf////gAAAAH//wAAAAAAAOsgfYCAAAAAAAAAAAAAP////AAAAAP//4AAAAAAAAKAAMDAAAAAAAAAAAAAP///+AAAAAH//4AAAAAAAAACCAAAAAAAAAAAAAAAH///8AAAAAP//4IAAAAAAAAHjAAAAAAAAAAAAAAAH///8AAAAAP//4IAAAAAAAAvDgAAAAAAAAAAAAAAD///8AAAAAP//44AAAAAAAD/jgAAAAAAAAAAAAAAA///8AAAAAP//h4AAAAAAAH/7gAACAAAAAAAAAAAAf//4AAAAAP//B4AAAAAAAH//wAAAAAAAAAAAAAAAf//4AAAAAH/+BwAAAAAAAf//4AQAAAAAAAAAAAAAf//4AAAAAH//BwAAAAAAD///8AIAAAAAAAAAAAAAf//AAAAAAH//BwAAAAAAD///+AAAAAAAAAAAAAAAf/8AAAAAAD/+BgAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAH////AAAAAAAAAAAAAAA//8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAA//4AAAAAAB/4AAAAAAAAD////AAAAAAAAAAAAAAA//wAAAAAAA/wAAAAAAAAB////AAAAAAAAAAAAAAA//gAAAAAAA/gAAAAAAAAB/h//AAAAAAAAAAAAAAA//AAAAAAAA+AAAAAAAAAD8Av+AAAAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAP8AAQAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAH8AAIAAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAAADwAAOAAAAAAAAAAAB/AAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAD+AAAAAAAAAAAAAAAAAAAAAAA4AA4AAAAAAAAAAAD+AAAAAAAAAAAAAAAAAAAAAAAYABgAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4AAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAP4AACAf/H//gAAAAAAAAAAAAAAAEAAAAAAAAAACD//8D///////8AAAAAAAAAAAAAAA/AAAAAAAAHwP///8f////////8AAAAAAAAAAAAAD3gAAAADf///////8///////////AAAAAAAAAHAoAPgAAAAP///////////////////+AAAAAB//4B////gAAAAf///////////////////4AAAAD////////4AAAAH////////////////////gAAAP////////8AAAAH/////////////////////gAABz////////wAAPg//////////////////////4AAAAD///////+Dw/AD////////////////////+AAAAB//////////gf///////////////////////AAAAB///////////////////////////////////+A/+CA////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////";

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
