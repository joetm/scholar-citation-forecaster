import { describe, it, expect } from 'vitest';
import { gaussianLogLik, aicc } from '../../src/stats/ic.js';

describe('stats/ic', () => {
  it('gaussianLogLik returns the standard formula on the y-scale', () => {
    const residuals = [-1, 0, 1, 0, 0];
    const n = residuals.length;
    const sigma2 = 2 / n;
    const expected = -n / 2 * (Math.log(2 * Math.PI) + Math.log(sigma2) + 1);
    expect(gaussianLogLik(residuals)).toBeCloseTo(expected, 6);
  });

  it('aicc penalizes complexity; ties go to the formula', () => {
    expect(aicc({ logLik: -10, k: 2, n: 8 })).toBeCloseTo(26.4, 6);
  });

  it('aicc returns Infinity when n - k - 1 <= 0', () => {
    expect(aicc({ logLik: -1, k: 3, n: 4 })).toBe(Infinity);
    expect(aicc({ logLik: -1, k: 3, n: 3 })).toBe(Infinity);
  });

  it('gaussianLogLik returns Infinity when SSR is exactly 0 (perfect fit)', () => {
    expect(gaussianLogLik([0, 0, 0])).toBe(Infinity);
  });
});
