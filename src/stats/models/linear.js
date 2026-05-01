import { mean } from '../helpers.js';

export class LinearModel {
  static fit(history) {
    if (history.length < 2) throw new RangeError('LinearModel needs n >= 2');
    const ts = history.map(h => h.year);
    const ys = history.map(h => h.count);
    const tBar = mean(ts);
    const yBar = mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < ts.length; i++) {
      const dt = ts[i] - tBar;
      num += dt * (ys[i] - yBar);
      den += dt * dt;
    }
    if (den === 0) throw new RangeError('LinearModel: zero variance in years');
    const b = num / den;
    const a = yBar - b * tBar;
    return new LinearModel(history, a, b);
  }

  constructor(history, a, b) {
    this._history = history;
    this._a = a;
    this._b = b;
  }

  predict(year) { return this._a + this._b * year; }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 2; }
  get name() { return 'linear'; }
}
