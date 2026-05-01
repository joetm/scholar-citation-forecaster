import { describe, it, expect } from 'vitest';
import { ConstantModel } from '../../../src/stats/models/constant.js';

describe('ConstantModel', () => {
  const history = [
    { year: 2020, count: 10 },
    { year: 2021, count: 12 },
    { year: 2022, count: 11 }
  ];

  it('predicts the mean for any year', () => {
    const m = ConstantModel.fit(history);
    expect(m.predict(2023)).toBeCloseTo(11);
    expect(m.predict(2050)).toBeCloseTo(11);
  });

  it('residuals are y_i - mean', () => {
    const m = ConstantModel.fit(history);
    expect(m.residuals).toEqual([-1, 1, 0]);
  });

  it('reports k_params = 1 and name = "constant"', () => {
    const m = ConstantModel.fit(history);
    expect(m.k_params).toBe(1);
    expect(m.name).toBe('constant');
  });

  it('throws RangeError on empty history', () => {
    expect(() => ConstantModel.fit([])).toThrow(RangeError);
  });
});
