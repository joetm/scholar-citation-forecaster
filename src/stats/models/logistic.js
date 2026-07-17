import { mean, median } from '../helpers.js';
import { levenbergMarquardt } from '../lm.js';

export class LogisticModel {
  static fit(history) {
    if (history.length < 3) throw new RangeError('LogisticModel needs n >= 3');
    const ts = history.map(h => h.year);
    const ys = history.map(h => h.count);
    const tBar = mean(ts);
    const xs = ts.map(t => t - tBar);
    const maxY = Math.max(...ys);
    const range = Math.max(...xs) - Math.min(...xs) || 1;

    const L0 = Math.max(maxY * 1.2, 1);
    const x0_0 = median(xs);
    const k0 = 4 / range;

    const residual = (p) => {
      const [L, k, x0] = p;
      return xs.map((x, i) => ys[i] - L / (1 + Math.exp(-k * (x - x0))));
    };
    const jacobian = (p) => {
      const [L, k, x0] = p;
      return xs.map(x => {
        const s = 1 / (1 + Math.exp(-k * (x - x0)));
        const dL = s;
        const dk = L * s * (1 - s) * (x - x0);
        const dx0 = -L * k * s * (1 - s);
        return [dL, dk, dx0];
      });
    };

    const { params } = levenbergMarquardt({
      residual, jacobian, params0: [L0, k0, x0_0]
    });
    return new LogisticModel(history, tBar, ...params);
  }

  constructor(history, tBar, L, k, x0) {
    this._history = history;
    this._tBar = tBar;
    this._L = L; this._k = k; this._x0 = x0;
  }

  predict(year) {
    const x = year - this._tBar;
    return this._L / (1 + Math.exp(-this._k * (x - this._x0)));
  }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 3; }
  get name() { return 'logistic'; }
}
