const RNG = {
  int(max) { // равномерно 0..max-1, без смещения
    const lim = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % max;
  },
  pick(arr) { return arr[this.int(arr.length)]; }
};
