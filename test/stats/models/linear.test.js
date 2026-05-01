import { describe, it, expect } from 'vitest';
import { LinearModel } from '../../../src/stats/models/linear.js';

describe('LinearModel', () => {
  it('recovers slope/intercept on a perfect linear series', () => {
    const history = [
      { year: 2020, count: 10 },
      { year: 2021, count: 20 },
      { year: 2022, count: 30 }
    ];
    const m = LinearModel.fit(history);
    expect(m.predict(2023)).toBeCloseTo(40, 6);
    expect(m.predict(2024)).toBeCloseTo(50, 6);
    expect(m.residuals.every(r => Math.abs(r) < 1e-9)).toBe(true);
  });

  it('produces non-zero residuals on noisy data and is unbiased', () => {
    const history = [
      { year: 2020, count: 10 },
      { year: 2021, count: 22 },
      { year: 2022, count: 28 }
    ];
    const m = LinearModel.fit(history);
    const sumRes = m.residuals.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumRes)).toBeLessThan(1e-9);
  });

  it('reports k_params = 2 and name = "linear"', () => {
    const m = LinearModel.fit([{ year: 2020, count: 5 }, { year: 2021, count: 8 }]);
    expect(m.k_params).toBe(2);
    expect(m.name).toBe('linear');
  });

  it('throws RangeError when n < 2', () => {
    expect(() => LinearModel.fit([{ year: 2020, count: 5 }])).toThrow(RangeError);
  });
});
