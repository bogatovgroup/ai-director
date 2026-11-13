const COLORS = ['#2de2ff', '#ff3d9a', '#a6ff3d', '#ffd23d', '#b24dff'];
const Draw = {
  DURATION: 20000, timer: null,
  // winner выбран заранее честным RNG; анимация на результат не влияет
  run(rows, active, winner, onFlash, onDone) {
    const t0 = performance.now(); let last = -1, ci = 0;
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / this.DURATION);
      if (p >= 1) { onDone(); return; }
      let cand; do { cand = RNG.pick(active); } while (active.length > 1 && cand.n === last);
      last = cand.n; ci = (ci + 1 + RNG.int(3)) % COLORS.length;
      onFlash(cand, COLORS[ci], p);
      const gap = 90 + Math.pow(p, 3) * 700;          // 90 мс → ~800 мс к концу
      this.timer = setTimeout(step, gap);
    };
    step();
  },
  stop() { clearTimeout(this.timer); }
};
