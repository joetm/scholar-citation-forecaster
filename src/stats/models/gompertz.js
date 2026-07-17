import { mean } from '../helpers.js';
import { levenbergMarquardt } from '../lm.js';

export class GompertzModel {
  static fit(history) {
    if (history.length < 3) throw new RangeError('GompertzModel needs n >= 3');
    const ts = history.map(h => h.year);
    const ys = history.map(h => h.count);
    const tBar = mean(ts);
    const xs = ts.map(t => t - tBar);
    const maxY = Math.max(...ys);
    const range = Math.max(...xs) - Math.min(...xs) || 1;

    const L0 = Math.max(maxY * 1.2, 1);
    const b0 = 1;
    const c0 = 2 / range;

    const residual = (p) => {
      const [L, b, c] = p;
      return xs.map((x, i) => {
        const u = Math.exp(-c * x);
        const f = L * Math.exp(-b * u);
        return ys[i] - f;
      });
    };
    const jacobian = (p) => {
      const [L, b, c] = p;
      return xs.map(x => {
        const u = Math.exp(-c * x);
        const inner = Math.exp(-b * u);
        const f = L * inner;
        const dL = inner;
        const db = -u * f;
        const dc = f * b * x * u;
        return [dL, db, dc];
      });
    };

    const { params } = levenbergMarquardt({
      residual, jacobian, params0: [L0, b0, c0]
    });
    return new GompertzModel(history, tBar, ...params);
  }

  constructor(history, tBar, L, b, c) {
    this._history = history;
    this._tBar = tBar;
    this._L = L; this._b = b; this._c = c;
  }

  predict(year) {
    const x = year - this._tBar;
    return this._L * Math.exp(-this._b * Math.exp(-this._c * x));
  }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 3; }
  get name() { return 'gompertz'; }
}
