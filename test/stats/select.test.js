import { describe, it, expect } from 'vitest';
import { selectBestModel } from '../../src/stats/select.js';

function genLinear(years, a, b) {
  return years.map(t => ({ year: t, count: a + b * t }));
}
function genConstant(years, c) {
  return years.map(t => ({ year: t, count: c }));
}
function genExp(years, a, b) {
  return years.map(t => ({ year: t, count: Math.exp(a + b * t) }));
}

describe('selectBestModel', () => {
  it('returns null on empty history', () => {
    expect(selectBestModel([])).toBe(null);
  });

  it('n=1 or n=2 → returns ConstantModel only', () => {
    const m1 = selectBestModel([{ year: 2025, count: 5 }]);
    expect(m1.model.name).toBe('constant');
    expect(m1.candidatesConsidered).toEqual(['constant']);

    const m2 = selectBestModel([{ year: 2024, count: 5 }, { year: 2025, count: 6 }]);
    expect(m2.model.name).toBe('constant');
  });

  it('n=3..4 → considers {constant, linear} only', () => {
    const result = selectBestModel(genLinear([2022, 2023, 2024, 2025], 0, 100));
    expect(result.candidatesConsidered.sort()).toEqual(['constant', 'linear']);
    expect(result.model.name).toBe('linear');
  });

  it('n=5 → adds log-linear', () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const result = selectBestModel(genExp(years, -4000, 2));
    expect(result.candidatesConsidered.includes('log-linear')).toBe(true);
    expect(result.model.name).toBe('log-linear');
  });

  it('n>=6 → considers all four candidates', () => {
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    const result = selectBestModel(genConstant(years, 50));
    expect(result.candidatesConsidered.sort()).toEqual(
      ['constant', 'linear', 'log-linear', 'quadratic'].sort()
    );
    expect(result.model.name).toBe('constant');
  });

  it('breaks ΔAICc < 2 ties toward fewer params', () => {
    const history = [
      { year: 2020, count: 10 }, { year: 2021, count: 11 },
      { year: 2022, count: 9 },  { year: 2023, count: 10 },
      { year: 2024, count: 11 }, { year: 2025, count: 10 }
    ];
    const result = selectBestModel(history);
    expect(result.model.name).toBe('constant');
  });

  it('result includes aicc and nYears', () => {
    const result = selectBestModel(genLinear([2022, 2023, 2024], 0, 1));
    expect(result.nYears).toBe(3);
    expect(typeof result.aicc).toBe('number');
  });
});
