// Приём заявок. Если задан вебхук Битрикс24 (crm.lead.add) - заявка уходит в CRM,
// иначе открывается письмо на info@aiskolkovo.ru (mailto). Секреты в публичный репозиторий не коммитить.
const BITRIX_WEBHOOK = "";
const MAIL = "info@aiskolkovo.ru";

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
  document.querySelectorAll("[data-sc]").forEach(function (b) {
    var sc = document.getElementById(b.getAttribute("data-for") || "sp");
    if (!sc) return;
    b.addEventListener("click", function () { sc.scrollBy({ left: Number(b.getAttribute("data-sc")) * 380, behavior: "smooth" }); });
  });
})();

// Вакансии HeadHunter: бегущая лента карточек (справа налево). Данные приходят с вашего сервера (api/vacancies.php),
// который обращается к API hh.ru с токеном. Пока сервера нет, лента показывает заглушки.
var VAC_URL = "api/vacancies.php";
var VAC_REFRESH_MS = 10 * 60 * 1000;

function vacEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function vacSalary(s) {
  if (!s || (!s.from && !s.to)) return "Зарплата не указана";
  var cur = { RUR: "₽", RUB: "₽", USD: "$", EUR: "€", KZT: "₸", BYR: "Br", BYN: "Br" }[s.currency] || (s.currency || "");
  var f = function (n) { return Number(n).toLocaleString("ru-RU"); };
  return (s.from ? "от " + f(s.from) + " " : "") + (s.to ? "до " + f(s.to) + " " : "") + cur;
}
function vacDate(iso) {
  var d = new Date(iso); if (isNaN(d)) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
function vacCard(v) {
  return '<a class="vac-card" href="' + vacEsc(v.url) + '" target="_blank" rel="noopener nofollow">' +
    '<h3>' + vacEsc(v.name) + '</h3><p class="vac-co">' + vacEsc(v.employer) + '</p><p class="vac-sal">' + vacEsc(vacSalary(v.salary)) + '</p>' +
    '<p class="vac-meta">' + vacEsc(v.area) + (v.published ? " · " + vacEsc(vacDate(v.published)) : "") + '</p><span class="vac-go">Открыть на hh.ru →</span></a>';
}
// дублируем карточки, чтобы лента крутилась без разрыва
function vacLoop() {
  var t = document.getElementById("hh-vacancies"); if (!t) return;
  t.querySelectorAll("[data-clone]").forEach(function (n) { n.remove(); });
  var items = Array.prototype.slice.call(t.children);
  items.forEach(function (n) { var c = n.cloneNode(true); c.setAttribute("data-clone", "1"); c.setAttribute("aria-hidden", "true"); c.setAttribute("tabindex", "-1"); t.appendChild(c); });
  t.style.setProperty("--dur", Math.max(40, items.length * 7) + "s");
}
function loadVacancies() {
  var t = document.getElementById("hh-vacancies"); if (!t || !window.fetch) return;
  fetch(VAC_URL, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (d) {
    if (!d || !d.items || !d.items.length) return;
    t.innerHTML = d.items.map(vacCard).join(""); vacLoop();
  }).catch(function () { /* сервера нет - остаются заглушки */ });
}
vacLoop(); loadVacancies(); setInterval(loadVacancies, VAC_REFRESH_MS);


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
    var light = document.documentElement.getAttribute("data-theme") === "light";
    ctx.clearRect(0, 0, S, S);
    for (k = 0; k < stars.length; k++) {
      var st = stars[k], tw = 0.15 + 0.2 * Math.sin(time * 0.0012 + st.ph);
      ctx.fillStyle = light ? "rgba(91,33,182," + tw + ")" : "rgba(220,215,255," + tw + ")"; ctx.fillRect(cx + st.x * S * 0.48, cy + st.y * S * 0.48, 1.2 * K + 0.3, 1.2 * K + 0.3);
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
      ctx.fillStyle = light ? "rgba(" + Math.round(110 - 40 * t) + "," + Math.round(70 - 30 * t) + ",215," + (0.18 + 0.82 * t) + ")" : "rgba(" + Math.round(205 + 50 * t) + "," + Math.round(198 + 57 * t) + ",255," + (0.12 + 0.88 * t) + ")";
      for (j = 0; j < cnt; j += 2) ctx.fillRect(arr[j] - d / 2, arr[j + 1] - d / 2, d, d);
    }
    // лёгкая атмосфера по краю
    var rg = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.07);
    var rc = light ? "91,33,182" : "180,165,255"; rg.addColorStop(0, "rgba(" + rc + ",0)"); rg.addColorStop(0.55, "rgba(" + rc + ",.13)"); rg.addColorStop(1, "rgba(" + rc + ",0)");
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

// Виджет вакансий HeadHunter: масштабируем под ширину блока, чтобы 4 карточки помещались без прокрутки
(function () {
  var box = document.querySelector(".hh-widget"), inner = box && box.querySelector(".hh-scale");
  if (!box || !inner) return;
  var W = 1260, H = 178;
  function fit() {
    var avail = box.clientWidth;
    if (avail >= 900) {
      var k = Math.min(1, avail / W);
      inner.style.transform = "scale(" + k + ")";
      box.style.height = Math.round(H * k) + "px";
      box.style.overflowX = "hidden";
    } else {
      inner.style.transform = ""; box.style.height = ""; box.style.overflowX = "auto";
    }
  }
  fit(); window.addEventListener("resize", fit);
})();

// Виджет вакансий: разряды в суммах зарплат (300000 -> 300 000). Виджет сам форматирования не делает, поправим в странице.
(function () {
  var box = document.querySelector(".hh-widget");
  if (!box || !window.MutationObserver) return;
  var busy = false;
  function fmt() {
    if (busy) return; busy = true;
    var w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var t = n.nodeValue;
      if (t.indexOf("\u20BD") === -1 && !/\d{4,}/.test(t)) continue;
      var r = t.replace(/\d{4,}/g, function (d) { return d.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0"); });
      if (r !== t) n.nodeValue = r;
    }
    busy = false;
  }
  new MutationObserver(fmt).observe(box, { childList: true, subtree: true, characterData: true });
  fmt();
})();

// Окно «Стать амбассадором»: приглашение перейти на ai-dir.ru
(function () {
  var d = document.getElementById("ambDialog");
  if (!d || !d.showModal) return;
  document.querySelectorAll("[data-amb]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); d.showModal(); }); });
  d.querySelector(".x").addEventListener("click", function () { d.close(); });
  d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
})();

// Виджет вакансий: скрываем карточки без видимой зарплаты и пропускаем пустые страницы.
// Виджет сам такие вакансии не отсеивает (для них HeadHunter не отдаёт сумму), поэтому делаем это на странице.
(function () {
  var box = document.querySelector(".hh-widget");
  if (!box || !window.MutationObserver) return;
  var busy = false, dir = 1, hops = 0, PRICE = /\d[\d\u00A0 ]*\s*(\u20BD|\$|\u20AC)/;
  function arrows() { var s = box.querySelectorAll("svg"); return s.length >= 2 ? { prev: s[0], next: s[1] } : null; }
  function press(el) { ["mousedown", "mouseup", "click"].forEach(function (t) { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); }); }
  function clean() {
    if (busy) return; busy = true;
    var cards = box.querySelectorAll('a[href*="/vacancy/"]'), shown = 0;
    cards.forEach(function (a) {
      if (PRICE.test(a.innerText)) { a.style.display = ""; shown++; } else { a.style.display = "none"; }
    });
    var ar = arrows();
    if (cards.length && !shown && ar && hops < 30) {
      hops++;
      var m = box.innerText.match(/(\d+)\s*\/\s*(\d+)/), atEnd = m && m[1] === m[2], atStart = m && m[1] === "1";
      if (dir > 0 && atEnd) dir = -1; else if (dir < 0 && atStart) dir = 1;
      setTimeout(function () { press(dir > 0 ? ar.next : ar.prev); }, 0);
    } else { hops = 0; }
    busy = false;
  }
  box.addEventListener("click", function (e) {
    var ar = arrows(); if (!ar) return;
    var t = e.target.closest ? e.target.closest("svg") : null;
    if (t === ar.next) dir = 1; else if (t === ar.prev) dir = -1;
  }, true);
  new MutationObserver(function () { setTimeout(clean, 0); }).observe(box, { childList: true, subtree: true });
  clean();
})();
