// Бургер-меню для узких экранов (телефоны, планшеты в портретной ориентации)
(function () {
  var b = document.getElementById("burger"), nav = document.getElementById("mainNav"), hdr = document.querySelector("header");
  if (!b || !nav || !hdr) return;
  function set(open) { hdr.classList.toggle("nav-open", open); b.setAttribute("aria-expanded", open ? "true" : "false"); }
  b.addEventListener("click", function (e) { e.stopPropagation(); set(!hdr.classList.contains("nav-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", function (e) { if (!hdr.contains(e.target)) set(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  window.addEventListener("resize", function () { if (window.innerWidth > 900) set(false); });
})();
