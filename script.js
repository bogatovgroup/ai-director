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
