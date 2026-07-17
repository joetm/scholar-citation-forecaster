import { describe, it, expect } from 'vitest';
import { GompertzModel } from '../../../src/stats/models/gompertz.js';

describe('GompertzModel', () => {
  it('recovers a gompertz curve: rises then saturates near L, asymmetrically', () => {
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const tBar = years.reduce((a, b) => a + b, 0) / years.length;
    const trueL = 300, trueB = 3, trueC = 0.5;
    const history = years.map(y => {
      const x = y - tBar;
      return { year: y, count: trueL * Math.exp(-trueB * Math.exp(-trueC * x)) };
    });
    const m = GompertzModel.fit(history);
    expect(m.predict(2045)).toBeCloseTo(trueL, 0);
    for (const r of m.residuals) expect(Math.abs(r)).toBeLessThan(1e-3);
  });

  it('reports k_params = 3 and name = "gompertz"', () => {
    const history = [
      { year: 2020, count: 5 }, { year: 2021, count: 15 }, { year: 2022, count: 40 },
      { year: 2023, count: 70 }, { year: 2024, count: 85 }, { year: 2025, count: 92 }
    ];
    const m = GompertzModel.fit(history);
    expect(m.k_params).toBe(3);
    expect(m.name).toBe('gompertz');
  });

  it('throws RangeError when n < 3', () => {
    expect(() => GompertzModel.fit([
      { year: 2020, count: 1 }, { year: 2021, count: 2 }
    ])).toThrow(RangeError);
  });
});
