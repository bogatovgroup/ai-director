const MAX = 60;
const normNick = v => v.trim().replace(/^@+/, '').toLowerCase();
const Participants = {
  validate(state, name, nick) {
    name = name.trim(); const raw = nick.trim().replace(/^@+/, '');
    if (!name) return 'Введите имя';
    if (!raw) return 'Введите ник Telegram';
    if (!/^[A-Za-z0-9_]{5,32}$/.test(raw)) return 'Ник: латиница, цифры, _ ; 5–32 символа';
    if (state.people.length >= MAX) return 'Достигнут лимит: ' + MAX;
    const dup = state.people.find(p => normNick(p.nick) === raw.toLowerCase());
    if (dup) return 'Такой участник уже есть в списке: №' + dup.n + ' ' + dup.name;
    return '';
  },
  add(state, name, nick) {
    state.people.push({ n: state.people.length + 1, name: name.trim(), nick: '@' + nick.trim().replace(/^@+/, ''), won: false, at: Date.now() });
  },
  remove(state, n) {
    state.people = state.people.filter(p => p.n !== n);
    state.people.forEach((p, i) => p.n = i + 1);
  },
  active(state) { return state.people.filter(p => !p.won); }
};
