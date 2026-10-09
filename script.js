// Bitrix24: вставьте URL входящего вебхука (crm.lead.add) вида https://ВАШ.bitrix24.by/rest/1/КОД/crm.lead.add.json
const BITRIX_WEBHOOK = "";
const dlg = document.getElementById("lead");
document.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); dlg.showModal(); }));
dlg.querySelector(".x").onclick = () => dlg.close();
document.querySelectorAll("form.lead-form").forEach(f => f.addEventListener("submit", async e => {
  e.preventDefault();
  const m = f.querySelector(".msg"), d = Object.fromEntries(new FormData(f));
  const q = new URLSearchParams(location.search);
  const fields = { TITLE: "Заявка с сайта ИИ Директор", NAME: d.name, PHONE: [{ VALUE: d.phone, VALUE_TYPE: "WORK" }],
    SOURCE_ID: "WEB", UTM_SOURCE: q.get("utm_source") || "", UTM_MEDIUM: q.get("utm_medium") || "",
    UTM_CAMPAIGN: q.get("utm_campaign") || "", UTM_CONTENT: q.get("utm_content") || "", UTM_TERM: q.get("utm_term") || "",
    COMMENTS: "Страница: " + location.href };
  if (!BITRIX_WEBHOOK) { m.textContent = "Заглушка: вебхук Битрикс24 не подключён (script.js)."; console.log(fields); return; }
  try {
    const r = await fetch(BITRIX_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
    if (!r.ok) throw 0; m.textContent = "Спасибо! Мы скоро свяжемся с вами."; f.reset();
  } catch { m.textContent = "Ошибка отправки, попробуйте ещё раз."; }
}));
