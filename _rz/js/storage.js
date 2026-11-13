const Store = {
  key: 'randomizer-v1',
  load() { try { return JSON.parse(localStorage.getItem(this.key)) || null; } catch (e) { return null; } },
  save(s) { try { localStorage.setItem(this.key, JSON.stringify(s)); } catch (e) {} }
};

const Log = { add(S, ev, d) { (S.log = S.log || []).push({ t: Date.now(), ev, d: d || '' }); } };
const Hash = { // SHA-256 списка участников (номер|имя|ник), чтобы заметить правку списка после остановки набора
  async of(people) {
    try {
      const s = people.map(p => p.n + '|' + p.name + '|' + p.nick).join('\n');
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) { return ''; }
  }
};
