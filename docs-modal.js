// Документы (оферта, политики, согласия, правила, PDF) открываются во всплывающем окне, а не на отдельной странице.
(function () {
  var dlg, body;
  function ensure() {
    if (dlg) return;
    dlg = document.createElement("dialog"); dlg.id = "docDialog"; dlg.setAttribute("aria-label", "Документ");
    dlg.innerHTML = '<button type="button" class="x" aria-label="Закрыть">×</button><div class="doc-scroll"></div>';
    document.body.appendChild(dlg); body = dlg.querySelector(".doc-scroll");
    dlg.querySelector(".x").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }
  function isDoc(a) {
    var u; try { u = new URL(a.href, location.href); } catch (e) { return false; }
    return u.origin === location.origin && (/\/legal\/[^\/]+\.html$/.test(u.pathname) || /\.pdf$/.test(u.pathname));
  }
  function show(url) {
    ensure();
    if (!dlg.showModal) { window.open(url, "_blank"); return; }
    var pdf = /\.pdf$/.test(new URL(url).pathname);
    body.innerHTML = '<p class="doc-loading">Загрузка…</p>';
    if (!dlg.open) dlg.showModal();
    if (pdf) {
      body.innerHTML = '<iframe class="doc-pdf" src="' + url + '" title="Документ"></iframe><p class="note" style="margin-top:10px"><a href="' + url + '" target="_blank" rel="noopener">Открыть в новой вкладке</a></p>';
      return;
    }
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
      var d = new DOMParser().parseFromString(t, "text/html"), el = d.querySelector(".doc");
      if (!el) throw 0;
      var wrap = document.createElement("div"); wrap.className = "doc"; wrap.innerHTML = el.innerHTML;
      wrap.querySelectorAll("a[href]").forEach(function (a) {
        var h = a.getAttribute("href");
        if (/^(#|mailto:|tel:|https?:)/.test(h)) return;
        a.setAttribute("href", new URL(h, url).href);
      });
      body.innerHTML = ""; body.appendChild(wrap); body.scrollTop = 0;
    }).catch(function () { if (dlg.open) dlg.close(); window.open(url, "_blank"); });
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (a && isDoc(a)) { e.preventDefault(); show(a.href); }
  });
})();
