import { mean } from '../helpers.js';

const ZERO_CLAMP = 0.5;

export class PowerLawModel {
  static fit(history) {
    if (history.length < 2) throw new RangeError('PowerLawModel needs n >= 2');
    const firstYear = Math.min(...history.map(h => h.year));
    const taus = history.map(h => h.year - firstYear + 1);
    const ys = history.map(h => h.count);
    const lts = taus.map(t => Math.log(t));
    const lys = ys.map(y => Math.log(Math.max(y, ZERO_CLAMP)));
    const ltBar = mean(lts);
    const lyBar = mean(lys);
    let num = 0, den = 0;
    for (let i = 0; i < lts.length; i++) {
      const dt = lts[i] - ltBar;
      num += dt * (lys[i] - lyBar);
      den += dt * dt;
    }
    if (den === 0) throw new RangeError('PowerLawModel: zero variance in log(years)');
    const b = num / den;
    const la = lyBar - b * ltBar;
    return new PowerLawModel(history, firstYear, Math.exp(la), b);
  }

  constructor(history, firstYear, a, b) {
    this._history = history;
    this._firstYear = firstYear;
    this._a = a; this._b = b;
  }

  predict(year) {
    const tau = year - this._firstYear + 1;
    return this._a * Math.pow(tau, this._b);
  }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 2; }
  get name() { return 'power-law'; }
}
