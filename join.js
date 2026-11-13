(function () {
  var $ = function (i) { return document.getElementById(i); };
  var form = $('jf'), err = $('err'), go = $('go');
  var list = $('list');
  for (var i = 1; i <= 60; i++) { var r = document.createElement('div'); r.className = 'row slot'; r.innerHTML = '<span class="n"></span><span class="nm"></span><span class="nk"></span>'; r.children[0].textContent = i; list.appendChild(r); }
  function setCount(c) {
    $('cnt').textContent = c;
    for (var k = 0; k < list.children.length; k++) { var on = k < c; list.children[k].className = 'row' + (on ? '' : ' slot'); list.children[k].children[1].textContent = on ? 'Занято' : ''; }
  }
  function show(el, on) { el.hidden = !on; }
  function setClosed(c) { show($('closed'), c); show($('form-box'), !c); }
  fetch('/join-api', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.open === false) setClosed(true);
    if (d && typeof d.count === 'number') setCount(d.count);
  }).catch(function () {});
  form.addEventListener('submit', function (e) {
    e.preventDefault(); err.textContent = '';
    var name = $('name').value.trim(), nick = $('nick').value.trim();
    if (!name) { err.textContent = 'Введите имя'; return; }
    if (!nick) { err.textContent = 'Введите ник Telegram'; return; }
    if (!$('consent').checked) { err.textContent = 'Нужно согласие на обработку персональных данных'; return; }
    go.disabled = true;
    fetch('/join-api', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, nick: nick, consent: true, website: $('website').value })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d, s: r.status }; }); })
      .then(function (x) {
        if (x.ok && x.d.ok) {
          show($('form-box'), false); var m = $('done');
          m.textContent = 'Вы в списке участников! ' + (x.d.n ? 'Ваш номер: №' + x.d.n + '. ' : '') + 'Следите за эфиром.';
          show(m, true);
          setCount((parseInt($('cnt').textContent, 10) || 0) + 1);
        } else {
          err.textContent = (x.d && x.d.error) || 'Не удалось отправить. Попробуйте ещё раз';
          if (x.s === 409 && x.d && /закрыт/.test(x.d.error || '')) setClosed(true);
          go.disabled = false;
        }
      }).catch(function () { err.textContent = 'Нет связи. Попробуйте ещё раз'; go.disabled = false; });
  });
})();
