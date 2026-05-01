import { mean } from '../helpers.js';

const ZERO_CLAMP = 0.5;

export class LogLinearModel {
  static fit(history) {
    if (history.length < 2) throw new RangeError('LogLinearModel needs n >= 2');
    const ts = history.map(h => h.year);
    const lys = history.map(h => Math.log(Math.max(h.count, ZERO_CLAMP)));
    const tBar = mean(ts);
    const lyBar = mean(lys);
    let num = 0, den = 0;
    for (let i = 0; i < ts.length; i++) {
      const dt = ts[i] - tBar;
      num += dt * (lys[i] - lyBar);
      den += dt * dt;
    }
    if (den === 0) throw new RangeError('LogLinearModel: zero variance in years');
    const b = num / den;
    const a = lyBar - b * tBar;
    return new LogLinearModel(history, a, b);
  }

  constructor(history, a, b) {
    this._history = history;
    this._a = a;
    this._b = b;
  }

  predict(year) { return Math.exp(this._a + this._b * year); }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 2; }
  get name() { return 'log-linear'; }
}
