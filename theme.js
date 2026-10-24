// Тема сайта: день (светлая) / ночь (тёмная). Выбор запоминается в браузере.
(function () {
  var KEY = "aidir_theme", root = document.documentElement, t = null;
  try { t = localStorage.getItem(KEY); } catch (e) {}
  if (t !== "light" && t !== "dark") t = (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
  root.setAttribute("data-theme", t);
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("themeToggle");
    if (!b) return;
    function paint() { var l = root.getAttribute("data-theme") === "light"; b.setAttribute("aria-pressed", l ? "true" : "false"); b.title = l ? "Включить ночной режим" : "Включить дневной режим"; }
    b.addEventListener("click", function () {
      var n = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", n);
      try { localStorage.setItem(KEY, n); } catch (e) {}
      paint();
    });
    paint();
  });
})();
