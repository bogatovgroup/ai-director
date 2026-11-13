(function () {
  var $ = function (i) { return document.getElementById(i); };
  var form = $('jf'), err = $('err'), go = $('go');
  var list = $('list');
  function buildRows(total) {
    list.innerHTML = ''; list.style.setProperty('--rows', total > 40 ? 30 : 20);
    for (var i = 1; i <= total; i++) { var r = document.createElement('div'); r.className = 'row slot'; r.innerHTML = '<span class="n"></span><span class="nm"></span><span class="nk"></span>'; r.children[0].textContent = i; list.appendChild(r); }
  }
  buildRows(40);
  var prevCount = null;
  function setPeople(ps) {
    $('cnt').textContent = ps.length;
    var total = Math.max(40, ps.length); if (list.children.length !== total) buildRows(total);
    for (var k = 0; k < list.children.length; k++) {
      var p = ps[k], row = list.children[k];
      row.classList.toggle('slot', !p);
      row.children[1].textContent = p ? p.name : ''; row.children[2].textContent = p ? p.nick : '';
    }
    if (prevCount !== null && ps.length > prevCount) { // новый участник: зелёная вспышка, как в админке
      ps.slice(prevCount).forEach(function (_, i) {
        var r = list.children[prevCount + i]; if (!r) return;
        r.style.setProperty('--c', '#a6ff3d'); r.classList.add('flash');
        setTimeout(function () { r.classList.remove('flash'); }, 1500);
      });
    }
    prevCount = ps.length;
  }
  var lastKey = '', timer = null, joined = false;
  function applyLive(lv) {
    var ph = (lv && lv.phase) || 'idle', key = ph + '|' + (lv && lv.n) + '|' + (lv && lv.color);
    if (key === lastKey) return; lastKey = key;
    var big = $('big'), rows = list.children, k;
    for (k = 0; k < rows.length; k++) rows[k].classList.remove('flash', 'blink3', 'final');
    var busy = ph !== 'idle';
    $('form-box').hidden = busy || joined || $('closed').hidden === false;
    $('big').hidden = !busy;
    $('winner').hidden = ph !== 'win';
    if (!busy) { big.classList.remove('on'); big.textContent = ''; return; }
    var row = rows[lv.n - 1];
    if (row) { row.style.setProperty('--c', lv.color); row.classList.add(ph === 'run' ? 'flash' : (ph === 'gold' ? 'blink3' : 'final')); }
    big.textContent = lv.n; big.style.setProperty('--c', lv.color); big.classList.toggle('on', ph !== 'win');
    if (ph === 'win') { $('w-num').textContent = '№' + lv.n; $('w-name').textContent = lv.name || ''; $('w-nick').textContent = lv.nick || ''; $('w-prize').textContent = lv.prize || ''; }
  }
  function pull() {
    return fetch('/join-api', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.open === false) setClosed(true);
      if (d && d.people) setPeople(d.people);
      applyLive(d && d.live);
      clearTimeout(timer); timer = setTimeout(pull, d && d.live && d.live.phase === 'run' ? 400 : 1500);
    }).catch(function () { clearTimeout(timer); timer = setTimeout(pull, 3000); });
  }
  function show(el, on) { el.hidden = !on; }
  function setClosed(c) { show($('closed'), c); show($('form-box'), !c); }
  pull();
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
          joined = true; show($('form-box'), false); var m = $('done');
          m.textContent = 'Вы в списке участников! ' + (x.d.n ? 'Ваш номер: №' + x.d.n + '. ' : '') + 'Следите за эфиром.';
          show(m, true);
          pull();
        } else {
          err.textContent = (x.d && x.d.error) || 'Не удалось отправить. Попробуйте ещё раз';
          if (x.s === 409 && x.d && /закрыт/.test(x.d.error || '')) setClosed(true);
          go.disabled = false;
        }
      }).catch(function () { err.textContent = 'Нет связи. Попробуйте ещё раз'; go.disabled = false; });
  });
})();
