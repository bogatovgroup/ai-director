// Приём заявок. Если задан вебхук Битрикс24 (crm.lead.add) – заявка уходит в CRM,
// иначе открывается письмо на info@ai-corp.by (mailto). Секреты в публичный репозиторий не коммитить.
const BITRIX_WEBHOOK = "";
const MAIL = "info@ai-corp.by";

const who = document.getElementById("who"), company = document.getElementById("company");
who.addEventListener("change", () => { const c = who.value === "компанию"; company.style.display = c ? "" : "none"; company.required = c; });

document.querySelector("form.lead-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, m = f.querySelector(".msg"), d = Object.fromEntries(new FormData(f)), q = new URLSearchParams(location.search);
  const text = ["Имя: " + d.name, "Email: " + d.email, "Контакт: " + d.contact, "Формат: " + d.format,
    "Заявка для: " + d.who + (d.company ? " (" + d.company + ")" : ""), "Комментарий: " + (d.comment || "–")].join("\n");
  if (!BITRIX_WEBHOOK) {
    location.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent("Заявка: Директор по внедрению ИИ") + "&body=" + encodeURIComponent(text);
    m.textContent = "Открылось письмо в вашей почтовой программе – отправьте его. Если не открылось, напишите на " + MAIL + ".";
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
  verdict.innerHTML = n <= 1 ? "<strong>0–1 «да» – доработка.</strong> Опишите, какие данные нужно подготовить, и повторите оценку."
    : n <= 3 ? "<strong>2–3 «да» – условный допуск.</strong> Запишите условия: что сделать, кто отвечает, к какому сроку. Условный допуск без записанных условий, ответственных и сроков не является условным допуском."
    : "<strong>4–5 «да» – предварительный допуск по данным.</strong> Это не разрешение на запуск проекта: право использования данных, безопасность и экономика проверяются отдельно.";
  verdict.style.display = "block";
});
