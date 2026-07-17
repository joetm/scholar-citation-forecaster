import { describe, it, expect } from 'vitest';
import { PowerLawModel } from '../../../src/stats/models/power-law.js';

describe('PowerLawModel', () => {
  it('recovers y = 5 * tau^1.5 (tau = years since first history year)', () => {
    const firstYear = 2018;
    const history = [];
    for (let y = 2018; y <= 2023; y++) {
      const tau = y - firstYear + 1;
      history.push({ year: y, count: 5 * Math.pow(tau, 1.5) });
    }
    const m = PowerLawModel.fit(history);
    const tau2024 = 2024 - firstYear + 1;
    expect(m.predict(2024)).toBeCloseTo(5 * Math.pow(tau2024, 1.5), 2);
    for (const r of m.residuals) expect(Math.abs(r)).toBeLessThan(1e-6);
  });

  it('clamps zeros via log(max(y, 0.5)), same convention as log-linear', () => {
    const history = [
      { year: 2020, count: 0 },
      { year: 2021, count: 1 },
      { year: 2022, count: 4 }
    ];
    const m = PowerLawModel.fit(history);
    expect(Number.isFinite(m.predict(2023))).toBe(true);
    expect(m.predict(2023)).toBeGreaterThan(0);
  });

  it('reports k_params = 2 and name = "power-law"', () => {
    const m = PowerLawModel.fit([
      { year: 2020, count: 1 }, { year: 2021, count: 2 }, { year: 2022, count: 4 }
    ]);
    expect(m.k_params).toBe(2);
    expect(m.name).toBe('power-law');
  });

  it('throws RangeError when n < 2', () => {
    expect(() => PowerLawModel.fit([{ year: 2020, count: 1 }])).toThrow(RangeError);
  });
});
