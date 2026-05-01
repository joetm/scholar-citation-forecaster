import { mean } from '../helpers.js';

export class ConstantModel {
  static fit(history) {
    if (history.length === 0) throw new RangeError('ConstantModel needs n >= 1');
    const m = mean(history.map(h => h.count));
    return new ConstantModel(history, m);
  }

  constructor(history, value) {
    this._history = history;
    this._value = value;
  }

  predict(_year) { return this._value; }
  get residuals() { return this._history.map(h => h.count - this._value); }
  get k_params() { return 1; }
  get name() { return 'constant'; }
}
