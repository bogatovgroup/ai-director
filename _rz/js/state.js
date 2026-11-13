const $ = id => document.getElementById(id);
let S = Store.load() || { stage: 'collect', people: [], winners: [], prize: 'Промокод на скидку 99%' };
if (S.stage === 'drawing') { // обновили страницу посреди розыгрыша: победитель уже выбран при «Старте», заново не выбираем
  const w = S.drawWinner && S.people.find(p => p.n === S.drawWinner && !p.won);
  if (w) { w.won = true; S.pending = { n: w.n, name: w.name, nick: w.nick, prize: S.prize }; S.stage = 'done'; Log.add(S, 'обновление страницы', 'розыгрыш не перезапущен, победитель сохранён: №' + w.n); }
  else S.stage = 'closed';
  S.drawWinner = null; Store.save(S);
}
const save = () => Store.save(S);
Sound.on = true;

function render() {
  const list = $('list'); list.innerHTML = '';
  S.people.forEach(p => {
    const r = document.createElement('div'); r.className = 'row' + (p.won ? ' won' : ''); r.id = 'row' + p.n;
    r.innerHTML = '<span class="n"></span><span class="nm"></span><span class="nk"></span>';
    r.children[0].textContent = p.n; r.children[1].textContent = p.name; r.children[2].textContent = p.nick;
    if (S.stage === 'collect') { r.title = 'Клик — удалить'; r.style.cursor = 'pointer'; r.onclick = () => { Log.add(S, 'удаление', '№' + p.n + ' ' + p.nick); Participants.remove(S, p.n); save(); render(); }; }
    list.appendChild(r);
  });
  const total = Math.max(40, S.people.length); list.style.setProperty('--rows', total > 40 ? 30 : 20); // на старте 20 + 20 мест
  for (let i = S.people.length + 1; i <= total; i++) {
    const r = document.createElement('div'); r.className = 'row slot'; r.innerHTML = '<span class="n"></span><span class="nm"></span><span class="nk"></span>'; r.children[0].textContent = i; list.appendChild(r);
  }
  $('empty').hidden = true;
  $('count').textContent = S.people.length; $('cap').textContent = S.people.length > 40 ? 60 : 40;
  $('prize').value = S.prize;
  const st = S.stage, active = Participants.active(S).length;
  $('form-box').hidden = st !== 'collect';
  $('big').hidden = st === 'collect'; $('form-box').classList.toggle('xl', st === 'collect'); // до «Старт» на месте крупных цифр - крупные поля ввода
  $('btn-stop').hidden = !(st === 'collect' && S.opened); $('btn-stop').disabled = S.people.length < 2;
  $('btn-open').hidden = !(st === 'closed' || (st === 'collect' && !S.opened));
  $('btn-start').hidden = st !== 'closed'; $('btn-start').disabled = active < 1;
  $('hash').hidden = st === 'collect' || !S.hash; $('hash').textContent = 'Контрольная сумма списка: ' + (S.hash || '').slice(0, 12);
  $('btn-new').hidden = st !== 'done' || !!S.pending;
  $('btn-random').hidden = st === 'drawing';
  $('winners').innerHTML = ''; S.winners.forEach(w => { const li = document.createElement('li'); li.textContent = '№' + w.n + ' ' + w.name + ' '; const s = document.createElement('small'); s.textContent = w.nick; li.appendChild(s); const d = document.createElement('small'); d.className = 'wdate'; d.textContent = new Date(w.at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); li.appendChild(d); $('winners').appendChild(li); });
  $('no-winners').hidden = S.winners.length > 0;
}

$('form').onsubmit = e => {
  e.preventDefault();
  const err = Participants.validate(S, $('name').value, $('nick').value);
  if (err) { notify(err, false); return; }
  Participants.add(S, $('name').value, $('nick').value);
  const me = S.people[S.people.length - 1]; Log.add(S, 'добавление', '№' + me.n + ' ' + me.nick);
  $('name').value = ''; $('nick').value = ''; $('name').focus(); save(); render();
  notify('Вы успешно зарегистрированы: №' + me.n + ' ' + me.name, true);
  const row = $('row' + me.n); if (row) { row.style.setProperty('--c', '#a6ff3d'); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1500); }
};
let noteT;
function notify(text, ok) {
  const e = $('error'); e.textContent = text; e.className = 'error ' + (ok ? 'ok' : 'bad');
  clearTimeout(noteT); noteT = setTimeout(() => { e.textContent = ''; e.className = 'error'; }, 4000);
}
$('prize').oninput = () => { S.prize = $('prize').value; save(); };
// таймер набора: идёт с добавления первого участника, на кнопке «Остановить набор» в формате 00:00
function collectTime() {
  const s = S.collectStart ? Math.max(0, Math.floor((Date.now() - S.collectStart) / 1000)) : 0;
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function tickTimer() {
  if (S.stage !== 'collect' || !S.opened) return;
  if (S.people.length && !S.collectStart) { S.collectStart = Date.now(); save(); }
  $('btn-stop').textContent = 'Закрыть набор ' + collectTime();
}
setInterval(tickTimer, 500);
$('btn-stop').onclick = async () => {
  await JoinSync.ctl('close'); await JoinSync.pull();
  const dur = collectTime(); S.stage = 'closed'; S.hash = await Hash.of(S.people); Log.add(S, 'набор остановлен', 'участников: ' + S.people.length + ', длился набор ' + dur + ', сумма ' + (S.hash || '').slice(0, 12));
  save(); render();
};
// Участники, пришедшие по публичной ссылке /join: подтягиваем с сервера в список админа
const JoinSync = {
  async pull(force) { // force: из «Скачать», когда локальный список пуст, а на сервере уже есть участники
    if (S.stage !== 'collect' && !(force && !S.people.length && S.stage !== 'drawing')) return;
    const wasCollect = S.stage === 'collect';
    try {
      const r = await fetch(new URL('__list', location.href), { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) return;
      const d = await r.json(); let added = 0;
      for (const p of d.people || []) {
        const raw = String(p.nick || '').replace(/^@+/, '');
        if (S.people.length >= MAX) break;
        if (Participants.validate(S, String(p.name || ''), raw)) continue; // дубль или ошибка: пропускаем
        Participants.add(S, String(p.name), raw);
        const me = S.people[S.people.length - 1]; Log.add(S, 'добавление по ссылке /join', '№' + me.n + ' ' + me.nick); added++;
      }
      if (added) { if (!wasCollect) { S.stage = 'collect'; Log.add(S, 'синхронизация', 'список подтянут с сервера при скачивании'); } save(); render(); tickTimer(); }
    } catch (e) { /* сеть или сервер недоступны: список админа остаётся как есть */ }
  },
  live(data) { // ход розыгрыша для публичной страницы /join
    return fetch(new URL('__ctl', location.href), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'live', data }) }).catch(() => {});
  },
  ctl(action) { // open / close / reset на сервере
    return fetch(new URL('__ctl', location.href), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).catch(() => {});
  }
};
setInterval(() => JoinSync.pull(), 3000);
function newRound() { // исходное состояние: пустой список и поля ввода участников
  if (S.people.length) S.lastRound = { people: S.people, hash: S.hash, at: Date.now() }; // чтобы «Скачать» отдавал список и после сброса
  S.people = []; S.hash = null; S.pending = null; S.drawWinner = null; S.collectStart = null; S.stage = 'collect';
  S.opened = false; JoinSync.ctl('reset').then(() => JoinSync.ctl('close')); // новый набор: ссылка /join закрыта, пока не нажато «Открыть набор»
  $('error').textContent = ''; $('error').className = 'error'; $('form').reset();
}
let resetT;
$('btn-reset').onclick = () => { // двойное нажатие: обнуляет всех победителей, участники остаются
  const b = $('btn-reset');
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Точно сбросить?'; resetT = setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Сброс'; }, 3000); return; }
  clearTimeout(resetT); b.dataset.sure = ''; b.textContent = 'Сброс';
  S.winners = []; S.log = []; S.lastRound = null; // сброс обнуляет победителей и журнал
  Log.add(S, 'сброс', 'победители и журнал обнулены'); newRound(); save(); render();
};
$('btn-download').onclick = async () => { if (!S.people.length) await JoinSync.pull(true); Export.download(S); };
$('btn-admin').onclick = () => { $('admin').hidden = !$('admin').hidden; };
$('btn-open').onclick = async () => { // вернуть набор: участники снова могут записываться
  await JoinSync.ctl('open'); S.stage = 'collect'; S.opened = true; S.hash = null; S.collectStart = Date.now(); Log.add(S, 'набор открыт', 'участников: ' + S.people.length); save(); render(); tickTimer();
};
$('btn-new').onclick = () => { S.stage = 'closed'; save(); render(); };

function startDraw() {
  Sound.init();
  const active = Participants.active(S); if (!active.length) return;
  const winner = RNG.pick(active);
  S.drawWinner = winner.n; Log.add(S, 'старт', 'активных: ' + active.length + ', победитель зафиксирован до анимации: №' + winner.n);
  Sound.droneStart(Draw.DURATION / 1000);
  S.stage = 'drawing'; save(); $('winner').hidden = true;
  ['btn-stop', 'btn-start', 'btn-new'].forEach(i => $(i).disabled = true);
  document.querySelectorAll('.row').forEach(r => r.onclick = null);
  const big = $('big'); let prev = null;
  Draw.run(null, active, winner, (p, c, prog) => {
    if (prev) prev.classList.remove('flash');
    const row = $('row' + p.n); row.style.setProperty('--c', c); row.classList.add('flash'); prev = row;
    big.textContent = p.n; big.style.setProperty('--c', c); big.classList.add('on'); Sound.tick(prog);
    JoinSync.live({ phase: 'run', n: p.n, name: p.name, nick: p.nick, color: c });
  }, () => {
    if (prev) prev.classList.remove('flash');
    const row = $('row' + winner.n); row.style.setProperty('--c', '#ffd23d'); row.classList.add('blink3');
    big.textContent = winner.n; big.style.setProperty('--c', '#ffd23d'); Sound.droneStop(); Sound.gong();
    JoinSync.live({ phase: 'gold', n: winner.n, name: winner.name, nick: winner.nick, color: '#ffd23d' });
    S.pending = { n: winner.n, name: winner.name, nick: winner.nick, prize: S.prize };
    winner.won = true; S.stage = 'done'; S.drawWinner = null; Log.add(S, 'остановка на победителе', '№' + winner.n + ' ' + winner.nick); save();
    setTimeout(() => {
      big.classList.remove('on');
      $('w-num').textContent = '№' + winner.n; $('w-name').textContent = winner.name; $('w-nick').textContent = winner.nick; $('w-prize').textContent = S.prize;
      $('btn-redo').disabled = Participants.active(S).length < 1;
      $('winner').hidden = false; Sound.fanfare(); render();
      JoinSync.live({ phase: 'win', n: winner.n, name: winner.name, nick: winner.nick, prize: S.prize, color: '#ffd23d' });
      const wn = $('w-name'); wn.classList.remove('blink'); void wn.offsetWidth; wn.classList.add('blink');
      $('row' + winner.n) && $('row' + winner.n).classList.add('final');
    }, 2800);
  });
}
$('btn-start').onclick = async () => { // перед стартом проверяем, что список не менялся после остановки набора
  if (S.hash) { const h = await Hash.of(S.people); if (h && h !== S.hash) { Log.add(S, 'ошибка', 'список изменён после остановки набора'); save(); alert2('Список изменён после остановки набора. Розыгрыш не запущен.'); return; } }
  startDraw();
};
function alert2(t) { $('hash').hidden = false; $('hash').textContent = t; $('hash').classList.add('bad'); }
$('btn-ok').onclick = () => { // победитель записывается с датой только по нажатию админа
  if (S.pending) { Log.add(S, 'подтверждение', '№' + S.pending.n + ' ' + S.pending.nick); S.winners.push({ ...S.pending, at: Date.now() }); S.pending = null; save(); }
  newRound(); save(); $('winner').hidden = true; render();
};
$('btn-redo').onclick = () => { // победитель не на связи: исключаем и в список победителей не пишем
  if (S.pending) Log.add(S, 'переразыгрыш', 'исключён №' + S.pending.n + ' ' + S.pending.nick);
  S.pending = null; S.stage = 'closed'; save(); $('winner').hidden = true; render(); JoinSync.live({ phase: 'idle' }); startDraw();
};
$('btn-close').onclick = async () => { // сеанс уничтожается на сервере, дальше адрес отдаёт 404
  $('btn-close').disabled = true;
  try { await fetch(new URL('__logout', location.href), { method: 'POST', credentials: 'same-origin', cache: 'no-store' }); } catch (e) {}
  location.replace(new URL('./', location.href));
};
$('btn-random').onclick = () => {
  S = { stage: 'collect', people: [], winners: S.winners, prize: S.prize, log: S.log };
  const n = 'Анна Борис Вика Глеб Дина Егор Жанна Захар Инна Кирилл Лена Марк Нина Олег Рита Саша Тимур Уля Фёдор Хельга'.split(' ');
  const cnt = 10 + RNG.int(51); // от 10 до 60
  for (let i = 0; i < cnt; i++) Participants.add(S, n[i % n.length] + (i >= 20 ? ' ' + (i + 1) : ''), 'user_test_' + (i + 1));
  Log.add(S, 'тест', 'участников: ' + cnt); save(); render();
};
render(); tickTimer(); JoinSync.pull();
if (S.pending && S.stage === 'done') { // обновили страницу до подтверждения: показываем победителя снова
  $('w-num').textContent = '№' + S.pending.n; $('w-name').textContent = S.pending.name; $('w-nick').textContent = S.pending.nick; $('w-prize').textContent = S.pending.prize;
  $('btn-redo').disabled = Participants.active(S).length < 1; $('winner').hidden = false;
}
