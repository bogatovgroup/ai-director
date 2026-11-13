// Звук: низкий, "кинематографичный". Всё синтезируется в браузере, без файлов.
const Sound = {
  on: true, ctx: null, master: null, drn: null,
  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const c = this.ctx.createDynamicsCompressor();
        c.threshold.value = -14; c.ratio.value = 6;
        this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
        this.master.connect(c).connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
      } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  ok() { return this.on && this.ctx; },
  // низкий удар (бас-драм): синус с быстрым падением частоты
  thud(f0, f1, dur, vol, when = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  // шум через фильтр: щелчок/шипение
  burst(freq, q, dur, vol, type = 'bandpass', when = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + when, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  },
  // тик на каждую вспышку: тон плавно падает от высокого к басу за 15 секунд
  tick(p) {
    const f = 1100 * Math.pow(0.045, p);          // 1100 Гц -> ~50 Гц
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const v = 0.22 + p * 0.5;                      // низкие частоты громче, чтобы бас был слышен
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.25);
    if (p > 0.55) this.thud(90, 40, 0.18, 0.25 + (p - 0.55) * 0.8);
  },
  // фоновый гул тоже падает: высокий -> бас
  droneStart(sec = 15) {
    if (!this.ok() || this.drn) return;
    const t = this.ctx.currentTime, g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(260, t + sec);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + sec);
    const oscs = [[880, 55], [884, 55.6], [1320, 82.4]].map(([a, b], i) => {
      const o = this.ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + sec); o.connect(f); o.start(t); return o;
    });
    f.connect(g).connect(this.master); this.drn = { g, oscs };
  },
  droneStop() {
    if (!this.drn || !this.ctx) return;
    const { g, oscs } = this.drn, t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    oscs.forEach(o => o.stop(t + 0.15)); this.drn = null;
  },
  // аккорд "духовых": пила через фильтр
  chord(freqs, start, dur, vol) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + start;
    freqs.forEach(fr => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = fr; lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    });
  },
  // Гонг: звонкий, протяжный, затухает с эхом ровно за время мигания (5 x 0.5 с = 2.5 с, хвост до 2.8 с)
  gong() {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, base = 110;
    const bus = c.createGain(), dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain();
    dl.delayTime.value = 0.3; fb.gain.value = 0.5; wet.gain.value = 0.5;
    bus.connect(this.master); bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(this.master);
    this.thud(75, 35, 0.9, 0.6);
    this.burst(2600, 1.0, 0.18, 0.18, 'bandpass');
    [[1, 0.42, 2.8], [1.47, 0.38, 2.8], [2.09, 0.34, 2.7], [2.56, 0.3, 2.6], [3.02, 0.26, 2.5], [4.18, 0.2, 2.3], [5.4, 0.14, 2.0], [6.8, 0.1, 1.6]].forEach(([r, v, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(base * r * 1.015, t); o.frequency.exponentialRampToValueAtTime(base * r, t + 0.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
    });
  },
  // «Та-дам!»: короткий акцент, затем мощный разрешающий аккорд с басом
  fanfare() {
    this.droneStop();
    this.thud(110, 45, 0.3, 0.8);
    this.chord([98, 196, 293.7, 392], 0, 0.22, 0.09);               // «та» (соль)
    this.thud(80, 28, 2.6, 1.0, 0.3);
    this.burst(250, 0.7, 1.2, 0.3, 'lowpass', 0.3);
    this.chord([65.4, 130.8, 196, 261.6, 329.6, 523.3], 0.3, 2.8, 0.1); // «дам» (до мажор)
  }
};
