import { describe, it, expect } from 'vitest';
import { QuadraticModel } from '../../../src/stats/models/quadratic.js';

describe('QuadraticModel', () => {
  it('recovers a perfect parabola y = (t-2020)^2', () => {
    const history = [];
    for (let t = 2020; t <= 2026; t++) history.push({ year: t, count: (t - 2020) ** 2 });
    const m = QuadraticModel.fit(history);
    expect(m.predict(2027)).toBeCloseTo(49, 4);
    expect(m.predict(2028)).toBeCloseTo(64, 4);
    for (const r of m.residuals) expect(Math.abs(r)).toBeLessThan(1e-6);
  });

  it('reports k_params = 3 and name = "quadratic"', () => {
    const history = [];
    for (let t = 2020; t <= 2025; t++) history.push({ year: t, count: t });
    const m = QuadraticModel.fit(history);
    expect(m.k_params).toBe(3);
    expect(m.name).toBe('quadratic');
  });

  it('throws RangeError when n < 3', () => {
    expect(() => QuadraticModel.fit([
      { year: 2020, count: 1 }, { year: 2021, count: 2 }
    ])).toThrow(RangeError);
  });
});
