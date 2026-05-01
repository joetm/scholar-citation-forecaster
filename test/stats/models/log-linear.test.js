import { describe, it, expect } from 'vitest';
import { LogLinearModel } from '../../../src/stats/models/log-linear.js';

describe('LogLinearModel', () => {
  it('recovers exponential growth: y = 10 * 10^(t-2020) → predict 2023 ≈ 10000', () => {
    const history = [
      { year: 2020, count: 10 },
      { year: 2021, count: 100 },
      { year: 2022, count: 1000 }
    ];
    const m = LogLinearModel.fit(history);
    expect(m.predict(2023)).toBeCloseTo(10000, -1);
  });

  it('residuals are computed on the y-scale, not log-scale', () => {
    const history = [
      { year: 2020, count: 10 },
      { year: 2021, count: 100 },
      { year: 2022, count: 1000 }
    ];
    const m = LogLinearModel.fit(history);
    for (const r of m.residuals) expect(Math.abs(r)).toBeLessThan(1e-6);
  });

  it('clamps zeros via log(max(y, 0.5))', () => {
    const history = [
      { year: 2020, count: 0 },
      { year: 2021, count: 1 },
      { year: 2022, count: 4 }
    ];
    const m = LogLinearModel.fit(history);
    expect(Number.isFinite(m.predict(2023))).toBe(true);
    expect(m.predict(2023)).toBeGreaterThan(0);
  });

  it('reports k_params = 2 and name = "log-linear"', () => {
    const m = LogLinearModel.fit([
      { year: 2020, count: 1 }, { year: 2021, count: 2 }, { year: 2022, count: 4 }
    ]);
    expect(m.k_params).toBe(2);
    expect(m.name).toBe('log-linear');
  });

  it('throws RangeError when n < 2', () => {
    expect(() => LogLinearModel.fit([{ year: 2020, count: 1 }])).toThrow(RangeError);
  });
});
