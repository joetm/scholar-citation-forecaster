import { mean } from '../helpers.js';

function solve3x3(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
    }
    if (Math.abs(M[pivot][i]) < 1e-12) throw new RangeError('singular matrix in QuadraticModel');
    [M[i], M[pivot]] = [M[pivot], M[i]];
    for (let k = i + 1; k < 3; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= 3; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = M[i][3];
    for (let j = i + 1; j < 3; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

export class QuadraticModel {
  static fit(history) {
    if (history.length < 3) throw new RangeError('QuadraticModel needs n >= 3');
    const ts = history.map(h => h.year);
    const ys = history.map(h => h.count);
    const tBar = mean(ts);
    const xs = ts.map(t => t - tBar);
    const n = xs.length;
    let Sx = 0, Sx2 = 0, Sx3 = 0, Sx4 = 0, Sy = 0, Sxy = 0, Sx2y = 0;
    for (let i = 0; i < n; i++) {
      const x = xs[i], y = ys[i];
      Sx  += x;
      Sx2 += x * x;
      Sx3 += x * x * x;
      Sx4 += x * x * x * x;
      Sy  += y;
      Sxy += x * y;
      Sx2y += x * x * y;
    }
    const A = [
      [n,   Sx,  Sx2],
      [Sx,  Sx2, Sx3],
      [Sx2, Sx3, Sx4]
    ];
    const bVec = [Sy, Sxy, Sx2y];
    const [c0, c1, c2] = solve3x3(A, bVec);
    return new QuadraticModel(history, tBar, c0, c1, c2);
  }

  constructor(history, tBar, c0, c1, c2) {
    this._history = history;
    this._tBar = tBar;
    this._c0 = c0; this._c1 = c1; this._c2 = c2;
  }

  predict(year) {
    const x = year - this._tBar;
    return this._c0 + this._c1 * x + this._c2 * x * x;
  }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 3; }
  get name() { return 'quadratic'; }
}
